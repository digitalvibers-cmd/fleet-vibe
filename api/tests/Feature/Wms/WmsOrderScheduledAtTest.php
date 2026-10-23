<?php

namespace Tests\Feature\Wms;

use Fleetbase\FleetOps\Models\WmsIntegrationToken;

/**
 * `scheduled_at` on POST /v1/integrations/wms/orders.
 *
 * Only an input with an explicit non-zero UTC offset changes behaviour: it is
 * converted to UTC before storage. Every other form (no zone, `Z`, `+00:00`,
 * absent) is stored exactly as it always was.
 */
class WmsOrderScheduledAtTest extends WmsIntegrationTestCase
{
    public function test_positive_offset_is_converted_to_utc(): void
    {
        $response = $this->postOrder($this->orderPayload(['scheduled_at' => '2026-10-20T07:00:00+02:00']), self::LEGACY_TOKEN);

        $response->assertStatus(201);
        $this->assertSame('2026-10-20 05:00:00', $this->orderRow($response)->scheduled_at);
        $this->assertSame('2026-10-20T05:00:00+00:00', $response->json('scheduled_at'));
    }

    public function test_negative_offset_is_converted_to_utc(): void
    {
        $response = $this->postOrder($this->orderPayload(['scheduled_at' => '2026-10-20T07:00:00-03:00']), self::LEGACY_TOKEN);

        $response->assertStatus(201);
        $this->assertSame('2026-10-20 10:00:00', $this->orderRow($response)->scheduled_at);
        $this->assertSame('2026-10-20T10:00:00+00:00', $response->json('scheduled_at'));
    }

    public function test_offset_conversion_applies_to_per_client_tokens_too(): void
    {
        [, $plainTextToken] = WmsIntegrationToken::issueFor($this->customer, 'CookVibe');

        $response = $this->postOrder($this->orderPayload(['scheduled_at' => '2026-10-20T07:00:00+02:00']), $plainTextToken);

        $response->assertStatus(201);
        $this->assertSame('2026-10-20 05:00:00', $this->orderRow($response)->scheduled_at);
    }

    public function test_input_without_zone_is_stored_verbatim(): void
    {
        $response = $this->postOrder($this->orderPayload(['scheduled_at' => '2026-10-20 07:00:00']), self::LEGACY_TOKEN);

        $response->assertStatus(201);
        $this->assertSame('2026-10-20 07:00:00', $this->orderRow($response)->scheduled_at);
        $this->assertSame('2026-10-20T07:00:00+00:00', $response->json('scheduled_at'));
    }

    public function test_input_with_z_suffix_is_stored_verbatim(): void
    {
        // What the customer portal Excel import sends (Date#toISOString()).
        $response = $this->postOrder($this->orderPayload(['scheduled_at' => '2026-10-20T07:00:00.000Z']), self::LEGACY_TOKEN);

        $response->assertStatus(201);
        $this->assertSame('2026-10-20 07:00:00', $this->orderRow($response)->scheduled_at);
        $this->assertSame('2026-10-20T07:00:00+00:00', $response->json('scheduled_at'));
    }

    public function test_input_with_explicit_zero_offset_is_stored_verbatim(): void
    {
        $response = $this->postOrder($this->orderPayload(['scheduled_at' => '2026-10-20T07:00:00+00:00']), self::LEGACY_TOKEN);

        $response->assertStatus(201);
        $this->assertSame('2026-10-20 07:00:00', $this->orderRow($response)->scheduled_at);
    }

    public function test_missing_field_stores_null(): void
    {
        $response = $this->postOrder($this->orderPayload(), self::LEGACY_TOKEN);

        $response->assertStatus(201);
        $this->assertNull($this->orderRow($response)->scheduled_at);
        $this->assertNull($response->json('scheduled_at'));
    }
}
