<?php

namespace Fleetbase\FleetOps\Http\Middleware;

use Closure;
use Fleetbase\FleetOps\Models\WmsIntegrationToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Authenticates POST /v1/integrations/wms/orders.
 *
 * Two kinds of bearer token are accepted:
 *
 *  1. Per-client token (LogiVibe, `wms_integration_tokens` table, issued with
 *     `fleetops:wms-token issue`). Bound to one customer Contact; the controller
 *     reads the customer from the token, exposed through REQUEST_ATTRIBUTE.
 *  2. Shared token from `.env` (`WMS_INTEGRATION_TOKEN`), used by the original
 *     WMS client. Checked exactly as before: a per-client lookup miss falls
 *     through to this path, so that client sees no change in behaviour.
 */
class AuthenticateWmsIntegration
{
    /**
     * Request attribute carrying the WmsIntegrationToken model when a per-client
     * token authenticated the request. Absent for the shared .env token.
     */
    public const REQUEST_ATTRIBUTE = 'wms_integration_token';

    public function handle(Request $request, Closure $next)
    {
        $providedToken = $this->extractBearerToken($request);

        // 1) Per-client token. A lookup miss — or any failure, e.g. the table not
        //    being migrated yet — falls through to the shared token below, so the
        //    legacy client can never be affected by this branch.
        if ($providedToken !== null) {
            $clientToken = $this->findClientToken($providedToken);
            if ($clientToken instanceof WmsIntegrationToken) {
                if ($clientToken->isRevoked()) {
                    return response()->json(['error' => 'WMS integration token has been revoked.'], 401);
                }

                session(['company' => $clientToken->company_uuid]);
                $request->attributes->set(self::REQUEST_ATTRIBUTE, $clientToken);
                $clientToken->markUsed();

                return $next($request);
            }
        }

        // 2) Shared token from .env — legacy behaviour, unchanged.
        $configuredToken = (string) config('fleetops.wms_integration.token', '');
        $companyUuid     = (string) config('fleetops.wms_integration.company_uuid', '');

        if ($configuredToken === '' || $companyUuid === '') {
            return response()->json(['error' => 'WMS integration is not configured on this server.'], 503);
        }

        if ($providedToken === null || !hash_equals($configuredToken, $providedToken)) {
            return response()->json(['error' => 'Invalid or missing WMS integration token.'], 401);
        }

        session(['company' => $companyUuid]);

        return $next($request);
    }

    private function findClientToken(string $providedToken): ?WmsIntegrationToken
    {
        try {
            return WmsIntegrationToken::findByPlainTextToken($providedToken);
        } catch (\Throwable $e) {
            Log::warning('[WMS API] Per-client token lookup failed, falling back to the shared token', [
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private function extractBearerToken(Request $request): ?string
    {
        $header = $request->header('Authorization', '');
        if (is_array($header)) {
            $header = $header[0] ?? '';
        }

        if (stripos($header, 'Bearer ') !== 0) {
            return null;
        }

        $token = trim(substr($header, 7));

        return $token === '' ? null : $token;
    }
}
