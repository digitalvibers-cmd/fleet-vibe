<?php

namespace Tests\Feature\Wms;

use Fleetbase\FleetOps\Models\WmsIntegrationToken;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Authentication on POST /v1/integrations/wms/orders.
 *
 * The shared `.env` token (legacy WMS client) must behave exactly as before.
 * Per-client tokens (`wms_integration_tokens`) bind the request to one customer.
 */
class WmsClientTokenTest extends WmsIntegrationTestCase
{
    // ---------------------------------------------------------------- legacy shared token

    public function test_shared_token_creates_order_for_body_customer_and_skips_unknown_custom_fields(): void
    {
        // A per-client token existing for the same customer must not interfere.
        [$clientToken] = WmsIntegrationToken::issueFor($this->customer, 'CookVibe');

        $payload = $this->orderPayload([
            'customer'            => ['id' => $this->otherCustomer->public_id],
            'custom_field_values' => [
                ['name' => 'cena-otkupa', 'value' => '1250'],
                ['name' => 'nepoznato-polje', 'value' => 'x'],
            ],
        ]);

        $response = $this->postOrder($payload, self::LEGACY_TOKEN);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'created')
            ->assertJsonPath('customer.id', $this->otherCustomer->public_id)
            ->assertJsonPath('internal_id', $payload['internal_id']);

        $order = $this->orderRow($response);
        $this->assertSame($this->otherCustomer->uuid, $order->customer_uuid);
        $this->assertSame($this->company->uuid, $order->company_uuid);
        $this->assertSame($this->orderConfig->uuid, $order->order_config_uuid);
        $this->assertSame(1, $this->customFieldValueCount($order->uuid), 'unknown custom field is skipped silently, known one stored');
        $this->assertNull($clientToken->fresh()->last_used_at, 'shared-token request never touches per-client tokens');
    }

    public function test_shared_token_with_unknown_customer_returns_404(): void
    {
        $response = $this->postOrder($this->orderPayload(['customer' => ['id' => 'contact_doesnotexist']]), self::LEGACY_TOKEN);

        $response->assertStatus(404)->assertJsonPath('error', 'Customer not found.');
        $this->assertSame(0, $this->orderCount());
    }

    public function test_unknown_bearer_token_returns_401(): void
    {
        $response = $this->postOrder($this->orderPayload(), WmsIntegrationToken::PLAIN_TEXT_PREFIX . Str::random(48));

        $response->assertStatus(401)->assertJsonPath('error', 'Invalid or missing WMS integration token.');
        $this->assertSame(0, $this->orderCount());
    }

    public function test_missing_bearer_token_returns_401(): void
    {
        $response = $this->postJson(self::ENDPOINT, $this->orderPayload());

        $response->assertStatus(401);
        $this->assertSame(0, $this->orderCount());
    }

    public function test_shared_token_unconfigured_returns_503_as_before(): void
    {
        config(['fleetops.wms_integration.token' => '']);

        $response = $this->postOrder($this->orderPayload(), self::LEGACY_TOKEN);

        $response->assertStatus(503);
    }

    // ---------------------------------------------------------------- per-client tokens

    public function test_client_token_creates_order_for_its_own_customer(): void
    {
        [$token, $plainTextToken] = WmsIntegrationToken::issueFor($this->customer, 'CookVibe produkcija');

        $response = $this->postOrder($this->orderPayload(), $plainTextToken);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'created')
            ->assertJsonPath('customer.id', $this->customer->public_id);

        $order = $this->orderRow($response);
        $this->assertSame($this->customer->uuid, $order->customer_uuid);
        $this->assertSame($this->company->uuid, $order->company_uuid);
        $this->assertSame(1, $this->customFieldValueCount($order->uuid));
        $this->assertNotNull($token->fresh()->last_used_at);
    }

    public function test_client_token_rejects_another_customers_id(): void
    {
        [, $plainTextToken] = WmsIntegrationToken::issueFor($this->customer, 'CookVibe');

        $response = $this->postOrder($this->orderPayload(['customer' => ['id' => $this->otherCustomer->public_id]]), $plainTextToken);

        $response->assertStatus(403)->assertJsonPath('error', 'Customer does not match the integration token.');
        $this->assertSame(0, $this->orderCount());
    }

    public function test_client_token_rejects_unknown_customer_id(): void
    {
        [, $plainTextToken] = WmsIntegrationToken::issueFor($this->customer, 'CookVibe');

        $response = $this->postOrder($this->orderPayload(['customer' => ['id' => 'contact_doesnotexist']]), $plainTextToken);

        $response->assertStatus(403);
        $this->assertSame(0, $this->orderCount());
    }

    public function test_revoked_client_token_returns_401(): void
    {
        [$token, $plainTextToken] = WmsIntegrationToken::issueFor($this->customer, 'CookVibe');
        $token->revoke();

        $response = $this->postOrder($this->orderPayload(), $plainTextToken);

        $response->assertStatus(401)->assertJsonPath('error', 'WMS integration token has been revoked.');
        $this->assertSame(0, $this->orderCount());
    }

    public function test_client_token_works_even_when_shared_token_is_not_configured(): void
    {
        config(['fleetops.wms_integration.token' => '', 'fleetops.wms_integration.company_uuid' => '']);
        [, $plainTextToken] = WmsIntegrationToken::issueFor($this->customer, 'CookVibe');

        $this->postOrder($this->orderPayload(), $plainTextToken)->assertStatus(201);
    }

    public function test_only_the_hash_of_the_token_is_stored(): void
    {
        [$token, $plainTextToken] = WmsIntegrationToken::issueFor($this->customer, 'CookVibe');

        $row = DB::table('wms_integration_tokens')->where('uuid', $token->uuid)->first();

        $this->assertSame(hash('sha256', $plainTextToken), $row->token_hash);
        $this->assertStringStartsWith(WmsIntegrationToken::PLAIN_TEXT_PREFIX, $plainTextToken);
        $this->assertStringStartsWith($row->token_prefix, $plainTextToken);
        $this->assertStringNotContainsString($plainTextToken, json_encode((array) $row));
        $this->assertArrayNotHasKey('token_hash', $token->toArray());
    }

    // ---------------------------------------------------------------- artisan command

    public function test_artisan_command_issues_lists_and_revokes_tokens(): void
    {
        $exit = Artisan::call('fleetops:wms-token', [
            'action'  => 'issue',
            'subject' => $this->customer->public_id,
            '--name'  => 'CookVibe produkcija',
        ]);
        $output = Artisan::output();

        $this->assertSame(0, $exit, $output);
        $this->assertSame(1, preg_match('/\bwms_[A-Za-z0-9]{48}\b/', $output, $matches), $output);
        $plainTextToken = $matches[0];

        $token = WmsIntegrationToken::findByPlainTextToken($plainTextToken);
        $this->assertNotNull($token);
        $this->assertSame($this->customer->uuid, $token->contact_uuid);
        $this->assertSame($this->company->uuid, $token->company_uuid);
        $this->assertSame('CookVibe produkcija', $token->name);
        $this->assertStringContainsString($token->public_id, $output);

        // The issued token authenticates and binds the request to its customer.
        $this->postOrder($this->orderPayload(), $plainTextToken)->assertStatus(201);

        $exit = Artisan::call('fleetops:wms-token', ['action' => 'list', 'subject' => $this->customer->public_id]);
        $this->assertSame(0, $exit);
        $this->assertStringContainsString($token->public_id, Artisan::output());

        $exit = Artisan::call('fleetops:wms-token', ['action' => 'revoke', 'subject' => $token->public_id]);
        $this->assertSame(0, $exit, Artisan::output());
        $this->assertTrue($token->fresh()->isRevoked());

        $this->postOrder($this->orderPayload(), $plainTextToken)->assertStatus(401);
    }

    public function test_artisan_command_refuses_unknown_or_non_customer_contact(): void
    {
        $exit = Artisan::call('fleetops:wms-token', ['action' => 'issue', 'subject' => 'contact_doesnotexist']);

        $this->assertSame(1, $exit);
        $this->assertStringContainsString('not found', Artisan::output());
        $this->assertSame(0, WmsIntegrationToken::count());
    }
}
