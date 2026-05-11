<?php

namespace Fleetbase\FleetOps\Console\Commands;

use Fleetbase\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * LogiVibe: one-shot cleanup for Sanctum tokens whose tokenable user no
 * longer exists. Run once after deploying the access-revocation patch so
 * customers that were deleted prior to the patch have their stale tokens
 * removed from `personal_access_tokens`.
 */
class PurgeOrphanCustomerTokens extends Command
{
    protected $signature = 'logivibe:purge-orphan-customer-tokens {--dry-run : Show count without deleting}';

    protected $description = 'Delete personal_access_tokens whose tokenable user no longer exists.';

    public function handle(): int
    {
        $query = DB::table('personal_access_tokens')
            ->where('tokenable_type', User::class)
            ->whereNotIn('tokenable_id', function ($sub) {
                $sub->select('uuid')->from('users');
            });

        $count = (clone $query)->count();

        if ($this->option('dry-run')) {
            $this->info("Would delete {$count} orphan token(s).");
            return self::SUCCESS;
        }

        $deleted = $query->delete();
        $this->info("Deleted {$deleted} orphan token(s).");

        return self::SUCCESS;
    }
}
