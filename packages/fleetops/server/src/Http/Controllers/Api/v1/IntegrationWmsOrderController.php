<?php

namespace Fleetbase\FleetOps\Http\Controllers\Api\v1;

use Fleetbase\FleetOps\Events\OrderReady;
use Fleetbase\FleetOps\Http\Middleware\AuthenticateWmsIntegration;
use Fleetbase\FleetOps\Models\Contact;
use Fleetbase\FleetOps\Models\Order;
use Fleetbase\FleetOps\Models\OrderConfig;
use Fleetbase\FleetOps\Models\Payload;
use Fleetbase\FleetOps\Models\Place;
use Fleetbase\FleetOps\Models\WmsIntegrationToken;
use Fleetbase\Http\Controllers\Controller;
use Fleetbase\Models\CustomField;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class IntegrationWmsOrderController extends Controller
{
    public function create(Request $request): JsonResponse
    {
        set_time_limit(180);

        $validator = Validator::make($request->all(), [
            'customer'                          => 'required|array',
            'customer.id'                       => 'required|string',
            'type'                              => 'sometimes|nullable|string',
            'order_config_uuid'                 => 'sometimes|nullable|string',
            'scheduled_at'                      => 'sometimes|nullable|date',
            'internal_id'                       => 'sometimes|nullable|string|max:191',
            'notes'                             => 'sometimes|nullable|string',
            'meta'                              => 'sometimes|nullable|array',
            'payload'                           => 'required|array',
            'payload.pickup'                    => 'required',
            'payload.dropoff'                   => 'required',
            'custom_field_values'               => 'sometimes|array',
            'custom_field_values.*.name'        => 'sometimes|nullable|string',
            'custom_field_values.*.custom_field_uuid' => 'sometimes|nullable|string',
            'custom_field_values.*.value'      => 'sometimes|nullable',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error'  => 'Validation failed.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $companyUuid = session('company');
        $input       = $validator->validated();

        // 1) Resolve existing customer (Contact). Do NOT create new contacts here.
        //    Per-client token (LogiVibe): the customer is the Contact the token was issued
        //    for, and `customer.id` in the body has to agree. Shared .env token: legacy
        //    behaviour — the customer comes from the body with no further checks.
        $clientToken = $request->attributes->get(AuthenticateWmsIntegration::REQUEST_ATTRIBUTE);
        if ($clientToken instanceof WmsIntegrationToken) {
            $contact = $clientToken->resolveCustomer();
            if (!$contact instanceof Contact) {
                return response()->json(['error' => 'Customer not found.'], 404);
            }

            $requestedCustomerId = trim((string) ($input['customer']['id'] ?? ''));
            if ($requestedCustomerId !== $contact->public_id) {
                return response()->json([
                    'error' => 'Customer does not match the integration token.',
                ], 403);
            }
        } else {
            $contact = $this->resolveCustomer($input['customer'], $companyUuid);
            if (!$contact instanceof Contact) {
                return response()->json(['error' => 'Customer not found.'], 404);
            }
        }

        // 2) Resolve OrderConfig
        $orderConfigIdentifier = $input['order_config_uuid'] ?? ($input['type'] ?? 'transport');
        $orderConfig           = OrderConfig::resolveFromIdentifier($orderConfigIdentifier);
        if (!$orderConfig) {
            return response()->json(['error' => 'Order config (type) could not be resolved.'], 422);
        }

        // 3) Build payload with pickup/dropoff Place models
        $payloadInput = $input['payload'];
        $pickup       = $payloadInput['pickup']   ?? null;
        $dropoff      = $payloadInput['dropoff']  ?? null;

        $payload = new Payload();
        $payload->company_uuid = $companyUuid;

        // Address resolution may geocode through Google; when that fails (dead key,
        // quota, unresolvable address) the Place comes back null and would 500 here.
        // A 500 makes the WMS client retry the same order forever — and every retry
        // is another billable geocode attempt — so fail permanently with a 422 instead.
        try {
            if ($pickup) {
                $payload->setPickup($pickup, [
                    'callback' => function ($pickup, $payload): void {
                        $payload->setCurrentWaypoint($pickup);
                    },
                ]);
            }
            if ($dropoff) {
                $payload->setDropoff($dropoff);
            }

            $payload->save();
        } catch (\Throwable $e) {
            Log::warning('[WMS API] Failed to resolve pickup/dropoff into a Place', [
                'error'   => $e->getMessage(),
                'pickup'  => is_scalar($pickup) ? $pickup : json_encode($pickup),
                'dropoff' => is_scalar($dropoff) ? $dropoff : json_encode($dropoff),
            ]);

            if ($payload->exists) {
                $payload->delete();
            }

            return response()->json([
                'error' => 'Pickup or dropoff address could not be resolved to a location. Do not retry unchanged — include explicit coordinates (e.g. {"name": ..., "street1": ..., "location": {"type": "Point", "coordinates": [lng, lat]}}) or correct the address.',
            ], 422);
        }

        $firstWaypoint = $payload->getPickupOrFirstWaypoint();
        if ($firstWaypoint instanceof Place) {
            $payload->setCurrentWaypoint($firstWaypoint);
        }

        // 4) Honor batch-import notification skip header
        if ($request->hasHeader('X-Skip-Order-Notification')) {
            app()->instance('fleetops.skip_order_notification', true);
        }

        // 5) Create the Order
        $orderAttributes = [
            'company_uuid'      => $companyUuid,
            'order_config_uuid' => $orderConfig->uuid,
            'type'              => $orderConfig->key,
            'payload_uuid'      => $payload->uuid,
            'status'            => 'created',
            'dispatched'        => false,
            'adhoc'             => false,
        ];
        if (!empty($input['internal_id'])) {
            $orderAttributes['internal_id'] = $input['internal_id'];
        }
        if (!empty($input['scheduled_at'])) {
            $orderAttributes['scheduled_at'] = $this->parseScheduledAt($input['scheduled_at']);
        }
        if (!empty($input['notes'])) {
            $orderAttributes['notes'] = $input['notes'];
        }
        if (!empty($input['meta']) && is_array($input['meta'])) {
            $orderAttributes['meta'] = $input['meta'];
        }

        $order = new Order($orderAttributes);
        $order->setCustomer($contact);
        $order->save();

        // 6) Sync custom field values (resolve name → uuid against this OrderConfig)
        $customFieldValues = $this->normalizeCustomFieldValues(
            $input['custom_field_values'] ?? [],
            $orderConfig->uuid
        );
        if (!empty($customFieldValues)) {
            try {
                $order->syncCustomFieldValues($customFieldValues);
            } catch (\Throwable $e) {
                Log::warning('[WMS API] Failed to sync custom field values', [
                    'order_uuid' => $order->uuid,
                    'error'      => $e->getMessage(),
                ]);
            }
        }

        // 7) Background side-effects (distance/time, OrderReady event → triggers notifications)
        $order->load(['trackingNumber', 'customer']);
        dispatch(function () use ($order): void {
            $order->setPreliminaryDistanceAndTime();
            event(new OrderReady($order));
        })->afterCommit();

        return response()->json([
            'id'              => $order->public_id,
            'internal_id'     => $order->internal_id,
            'status'          => $order->status,
            'tracking_number' => optional($order->trackingNumber)->tracking_number,
            'scheduled_at'    => optional($order->scheduled_at)->toIso8601String(),
            'customer'        => [
                'id'   => $contact->public_id,
                'name' => $contact->name,
            ],
        ], 201);
    }

    /**
     * Parse `scheduled_at` for storage.
     *
     * The app runs in UTC and Eloquent writes a Carbon in the zone it carries, so an
     * input with an explicit non-zero offset (`2026-10-20T07:00:00+02:00`) used to be
     * stored as `07:00` UTC — two hours late in the console. Only that case is
     * converted to UTC. A string without a zone, or with `Z` / `+00:00` (what the
     * portal Excel import sends), parses with offset 0 and is stored exactly as before.
     */
    private function parseScheduledAt($value): Carbon
    {
        $scheduledAt = Carbon::parse($value);

        if ($scheduledAt->getOffset() !== 0) {
            return $scheduledAt->utc();
        }

        return $scheduledAt;
    }

    private function resolveCustomer(array $customer, string $companyUuid): ?Contact
    {
        $id = trim((string) ($customer['id'] ?? ''));
        if ($id === '') {
            return null;
        }

        return Contact::where('company_uuid', $companyUuid)
            ->where('type', 'customer')
            ->where('public_id', $id)
            ->first();
    }

    private function normalizeCustomFieldValues(array $rows, string $orderConfigUuid): array
    {
        if (empty($rows)) {
            return [];
        }

        $fields       = CustomField::where('subject_uuid', $orderConfigUuid)->get(['uuid', 'name', 'type']);
        $fieldsByName = $fields->keyBy('name');
        $fieldsByUuid = $fields->keyBy('uuid');

        $normalized = [];
        foreach ($rows as $row) {
            $uuid = $row['custom_field_uuid'] ?? null;
            if (!$uuid && !empty($row['name']) && isset($fieldsByName[$row['name']])) {
                $uuid = $fieldsByName[$row['name']]->uuid;
            }
            if (!$uuid) {
                Log::warning('[WMS API] Skipping custom field value — unknown field', [
                    'name'              => $row['name'] ?? null,
                    'order_config_uuid' => $orderConfigUuid,
                ]);
                continue;
            }

            $field     = $fieldsByUuid[$uuid] ?? null;
            $valueType = $row['value_type'] ?? ($field->type ?? 'text');

            $normalized[] = [
                'custom_field_uuid' => $uuid,
                'value'             => $row['value'] ?? null,
                'value_type'        => $valueType,
            ];
        }

        return $normalized;
    }
}
