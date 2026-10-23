<?php

namespace Tests\Feature\Wms;

use Fleetbase\FleetOps\Models\Contact;
use Fleetbase\FleetOps\Models\OrderConfig;
use Fleetbase\FleetOps\Support\FleetOps;
use Fleetbase\FleetOps\Support\Utils;
use Fleetbase\Models\Company;
use Fleetbase\Models\CustomField;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Shared fixtures for the WMS order intake API (POST /v1/integrations/wms/orders).
 *
 * Every test runs inside a DB transaction that is rolled back afterwards, so the
 * suite can be pointed at any MySQL database with the Fleetbase schema (it needs
 * no seed data). Pickup/dropoff carry explicit coordinates so no geocoding call
 * is ever made; notifications and queued jobs are faked.
 *
 * Fixtures (company, customers) are inserted with model events disabled: the
 * contact observer would otherwise create portal users and assign Spatie roles
 * that only exist after `fleetbase:create-permissions`.
 *
 * The MySQL connection is opened WITHOUT PDO::ATTR_PERSISTENT (see createApplication):
 * core-api turns persistence on, and persistent links are shared by every test
 * application in the PHPUnit process, so a stale PDO object from an earlier test
 * rolls the current test's transaction back when it is garbage-collected mid-test
 * (random 404/500 with FK errors on tracking_numbers).
 */
abstract class WmsIntegrationTestCase extends TestCase
{
    use DatabaseTransactions;

    protected const ENDPOINT     = '/v1/integrations/wms/orders';
    protected const LEGACY_TOKEN = 'legacy-shared-wms-token-for-tests';

    protected Company $company;
    protected OrderConfig $orderConfig;
    protected Contact $customer;
    protected Contact $otherCustomer;

    /**
     * Boot the application with a non-persistent MySQL connection (see class docblock).
     */
    public function createApplication()
    {
        $app = require __DIR__ . '/../../../bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();

        $connection = $app['config']->get('database.default');
        $options    = $app['config']->get("database.connections.{$connection}.options", []);
        $options[\PDO::ATTR_PERSISTENT] = false;
        $app['config']->set("database.connections.{$connection}.options", $options);
        // Drop any connection a provider may already have opened during boot.
        $app['db']->purge($connection);

        return $app;
    }

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Bus::fake();

        $this->company = Company::withoutEvents(function () {
            $company = new Company();
            $company->forceFill([
                'uuid'      => (string) Str::uuid(),
                'public_id' => 'company_' . Str::lower(Str::random(10)),
                'name'      => 'WMS Test Co ' . Str::random(6),
                'status'    => 'active',
                'timezone'  => 'UTC',
                'country'   => 'RS',
                'currency'  => 'RSD',
            ])->save();

            return $company;
        });
        session(['company' => $this->company->uuid]);

        $this->orderConfig   = FleetOps::createTransportConfig($this->company);
        $this->customer      = $this->createCustomer('28 Ishrana');
        $this->otherCustomer = $this->createCustomer('Drugi Klijent');

        CustomField::create([
            'company_uuid' => $this->company->uuid,
            'subject_uuid' => $this->orderConfig->uuid,
            'subject_type' => Utils::getMutationType($this->orderConfig),
            'name'         => 'cena-otkupa',
            'label'        => 'Cena otkupa',
            'type'         => 'text',
        ]);

        config([
            'fleetops.wms_integration.token'        => self::LEGACY_TOKEN,
            'fleetops.wms_integration.company_uuid' => $this->company->uuid,
        ]);
    }

    protected function createCustomer(string $name): Contact
    {
        $company = $this->company;

        return Contact::withoutEvents(function () use ($company, $name) {
            $contact = new Contact();
            $contact->forceFill([
                'uuid'         => (string) Str::uuid(),
                'public_id'    => 'contact_' . Str::lower(Str::random(10)),
                'company_uuid' => $company->uuid,
                'name'         => $name,
                'type'         => 'customer',
                'email'        => Str::slug($name) . '-' . Str::lower(Str::random(6)) . '@wms-test.local',
            ])->save();

            return $contact;
        });
    }

    /**
     * A valid CookVibe-style order body for $this->customer. Addresses carry
     * coordinates so Place creation never hits the geocoder.
     */
    protected function orderPayload(array $overrides = []): array
    {
        return array_replace_recursive([
            'customer'    => ['id' => $this->customer->public_id],
            'type'        => 'transport',
            'internal_id' => 'SAL-ORD-' . Str::upper(Str::random(6)) . ':2026-10-20',
            'notes'       => 'Pozvati pre dolaska',
            'payload'     => [
                'pickup' => [
                    'name'        => '28 Ishrana kuhinja',
                    'street1'     => 'Bulevar Milutina Milankovica 1',
                    'city'        => 'Beograd',
                    'postal_code' => '11070',
                    'country'     => 'RS',
                    'location'    => ['type' => 'Point', 'coordinates' => [20.4210, 44.8140]],
                ],
                'dropoff' => [
                    'name'        => 'Petar Petrovic',
                    'phone'       => '+381601234567',
                    'street1'     => 'Knez Mihailova 10',
                    'city'        => 'Beograd',
                    'postal_code' => '11000',
                    'country'     => 'RS',
                    'location'    => ['type' => 'Point', 'coordinates' => [20.4573, 44.8176]],
                ],
            ],
            'custom_field_values' => [
                ['name' => 'cena-otkupa', 'value' => '1250'],
            ],
        ], $overrides);
    }

    protected function postOrder(array $payload, string $bearerToken): TestResponse
    {
        return $this->postJson(self::ENDPOINT, $payload, ['Authorization' => 'Bearer ' . $bearerToken]);
    }

    protected function orderCount(): int
    {
        return DB::table('orders')->where('company_uuid', $this->company->uuid)->count();
    }

    protected function orderRow(TestResponse $response): ?object
    {
        return DB::table('orders')->where('public_id', $response->json('id'))->first();
    }

    protected function customFieldValueCount(string $orderUuid): int
    {
        return DB::table('custom_field_values')->where('subject_uuid', $orderUuid)->count();
    }
}
