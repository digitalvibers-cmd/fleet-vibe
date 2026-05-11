<?php

namespace App\Services;

use Fleetbase\Models\CompanyUser;
use Fleetbase\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * LogiVibe: centralized customer-portal access revocation.
 *
 * Called from every code path that should kill an existing customer session
 * (hard delete, bulk delete, status flip to inactive, reset credentials).
 *
 * Tokens are deleted directly from `personal_access_tokens` so the lookup
 * still works after the User row is gone (hard-delete path).
 */
class CustomerAccessRevoker
{
    public function revokeTokens(User $user): int
    {
        return $this->purgeTokensByUuid($user->uuid);
    }

    public function revokeAccess(User $user): void
    {
        $this->purgeTokensByUuid($user->uuid);

        $user->update([
            'status'            => 'inactive',
            'email_verified_at' => null,
        ]);

        CompanyUser::where('user_uuid', $user->uuid)->update(['status' => 'inactive']);
    }

    public function purgeTokensByUuid(?string $userUuid): int
    {
        if (empty($userUuid)) {
            return 0;
        }

        try {
            return DB::table('personal_access_tokens')
                ->where('tokenable_type', User::class)
                ->where('tokenable_id', $userUuid)
                ->delete();
        } catch (\Throwable $e) {
            Log::error('CustomerAccessRevoker: failed to purge tokens', [
                'user_uuid' => $userUuid,
                'error'     => $e->getMessage(),
            ]);
            return 0;
        }
    }
}
