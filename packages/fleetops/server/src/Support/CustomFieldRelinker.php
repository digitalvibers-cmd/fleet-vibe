<?php

namespace Fleetbase\FleetOps\Support;

use Fleetbase\FleetOps\Models\Order;
use Fleetbase\FleetOps\Models\OrderConfig;
use Fleetbase\Models\CustomField;
use Fleetbase\Models\CustomFieldValue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class CustomFieldRelinker
{
    public function relinkForOrder(Order $order, string $oldConfigUuid): void
    {
        if (!$order->order_config_uuid || $order->wasRecentlyCreated) {
            return;
        }
        if ($oldConfigUuid === $order->order_config_uuid) {
            return;
        }

        try {
            DB::transaction(function () use ($order) {
                // Match by subject_uuid only — globally unique UUIDs make subject_type filter redundant
                // and Fleetbase stores subject_type inconsistently across packages (core-api stores
                // CustomField.subject_type as "\Fleetbase\Models\OrderConfig" with leading slash,
                // while CustomFieldValue.subject_type is "Fleetbase\FleetOps\Models\Order" without).
                $cfvs = CustomFieldValue::where('subject_uuid', $order->uuid)
                    ->with('customField')
                    ->get();
                if ($cfvs->isEmpty()) {
                    return;
                }

                $newConfigFields = CustomField::where('subject_uuid', $order->order_config_uuid)
                    ->get()
                    ->keyBy('name');
                if ($newConfigFields->isEmpty()) {
                    return;
                }

                foreach ($cfvs as $cfv) {
                    $oldField = $cfv->customField;
                    if (!$oldField || !$oldField->name) {
                        continue;
                    }
                    if ($oldField->subject_uuid === $order->order_config_uuid) {
                        continue;
                    }

                    $newField = $newConfigFields->get($oldField->name);
                    if (!$newField) {
                        continue;
                    }
                    if ($newField->uuid === $cfv->custom_field_uuid) {
                        continue;
                    }

                    $collision = CustomFieldValue::where('subject_uuid', $order->uuid)
                        ->where('custom_field_uuid', $newField->uuid)
                        ->where('uuid', '!=', $cfv->uuid)
                        ->exists();
                    if ($collision) {
                        $cfv->delete();
                        continue;
                    }

                    $cfv->update(['custom_field_uuid' => $newField->uuid]);
                }
            });
        } catch (Throwable $e) {
            Log::warning('CustomFieldRelinker failed for order ' . $order->uuid . ': ' . $e->getMessage(), [
                'order_uuid' => $order->uuid,
                'old_config_uuid' => $oldConfigUuid,
                'new_config_uuid' => $order->order_config_uuid,
                'exception' => $e,
            ]);
        }
    }
}
