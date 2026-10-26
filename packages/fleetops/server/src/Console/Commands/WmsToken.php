<?php

namespace Fleetbase\FleetOps\Console\Commands;

use Fleetbase\FleetOps\Models\Contact;
use Fleetbase\FleetOps\Models\WmsIntegrationToken;
use Illuminate\Console\Command;

/**
 * LogiVibe: issue, list and revoke per-client bearer tokens for the WMS order
 * intake API (POST /v1/integrations/wms/orders).
 *
 *   php artisan fleetops:wms-token issue contact_mW7zXXFnjb --name="CookVibe produkcija"
 *   php artisan fleetops:wms-token list [contact_mW7zXXFnjb]
 *   php artisan fleetops:wms-token revoke wms_token_xxxxxxxxxx
 *
 * The plain-text token is printed exactly once, on issue. Only its hash is stored.
 */
class WmsToken extends Command
{
    protected $signature = 'fleetops:wms-token
        {action : issue | list | revoke}
        {subject? : issue/list: customer Contact public_id or uuid — revoke: token public_id or uuid}
        {--name= : Label for the issued token, e.g. the client name}';

    protected $description = 'Issue, list or revoke per-client bearer tokens for POST /v1/integrations/wms/orders.';

    public function handle(): int
    {
        $action  = strtolower((string) $this->argument('action'));
        $subject = $this->argument('subject');
        $subject = is_string($subject) ? trim($subject) : null;

        switch ($action) {
            case 'issue':
                return $this->issue($subject);
            case 'list':
                return $this->listTokens($subject);
            case 'revoke':
                return $this->revoke($subject);
        }

        $this->error("Unknown action '{$action}'. Use: issue | list | revoke.");

        return self::FAILURE;
    }

    private function issue(?string $subject): int
    {
        if (!$subject) {
            $this->error('Usage: fleetops:wms-token issue {customer contact public_id or uuid} [--name=...]');

            return self::FAILURE;
        }

        $contact = $this->findCustomer($subject);
        if (!$contact) {
            $this->error("Customer contact '{$subject}' not found (must be a Contact of type 'customer').");

            return self::FAILURE;
        }

        $name = $this->option('name');
        [$token, $plainTextToken] = WmsIntegrationToken::issueFor($contact, is_string($name) && $name !== '' ? $name : null);

        $this->info('WMS integration token issued.');
        $this->table(
            ['Token', 'Name', 'Customer', 'Customer ID', 'Company'],
            [[$token->public_id, $token->name ?? '-', $contact->name, $contact->public_id, $token->company_uuid]]
        );
        $this->newLine();
        $this->warn('Plain-text token — shown ONCE, not stored. Copy it now:');
        $this->line($plainTextToken);

        return self::SUCCESS;
    }

    private function listTokens(?string $subject): int
    {
        $query = WmsIntegrationToken::query()->with('contact')->orderBy('created_at');

        if ($subject) {
            $contact = $this->findCustomer($subject);
            if (!$contact) {
                $this->error("Customer contact '{$subject}' not found (must be a Contact of type 'customer').");

                return self::FAILURE;
            }
            $query->where('contact_uuid', $contact->uuid);
        }

        $tokens = $query->get();
        if ($tokens->isEmpty()) {
            $this->info('No WMS integration tokens found.');

            return self::SUCCESS;
        }

        $this->table(
            ['Token', 'Name', 'Prefix', 'Customer', 'Customer ID', 'Created', 'Last used', 'Revoked'],
            $tokens->map(function (WmsIntegrationToken $token) {
                return [
                    $token->public_id,
                    $token->name ?? '-',
                    $token->token_prefix ? $token->token_prefix . '…' : '-',
                    $token->contact ? $token->contact->name : '(contact removed)',
                    $token->contact ? $token->contact->public_id : $token->contact_uuid,
                    optional($token->created_at)->toDateTimeString() ?? '-',
                    optional($token->last_used_at)->toDateTimeString() ?? 'never',
                    optional($token->revoked_at)->toDateTimeString() ?? '-',
                ];
            })->all()
        );

        return self::SUCCESS;
    }

    private function revoke(?string $subject): int
    {
        if (!$subject) {
            $this->error('Usage: fleetops:wms-token revoke {token public_id or uuid}');

            return self::FAILURE;
        }

        $token = WmsIntegrationToken::where(function ($query) use ($subject) {
            $query->where('public_id', $subject)->orWhere('uuid', $subject);
        })->first();

        if (!$token) {
            $this->error("Token '{$subject}' not found.");

            return self::FAILURE;
        }

        if ($token->isRevoked()) {
            $this->info("Token {$token->public_id} was already revoked at {$token->revoked_at->toDateTimeString()}.");

            return self::SUCCESS;
        }

        $token->revoke();
        $this->info("Token {$token->public_id} revoked. Requests using it now receive 401.");

        return self::SUCCESS;
    }

    private function findCustomer(string $subject): ?Contact
    {
        return Contact::where('type', 'customer')
            ->where(function ($query) use ($subject) {
                $query->where('public_id', $subject)->orWhere('uuid', $subject);
            })
            ->first();
    }
}
