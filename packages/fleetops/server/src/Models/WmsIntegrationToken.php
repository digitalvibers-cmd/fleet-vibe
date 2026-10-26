<?php

namespace Fleetbase\FleetOps\Models;

use Fleetbase\Casts\Json;
use Fleetbase\Models\Company;
use Fleetbase\Models\Model;
use Fleetbase\Models\User;
use Fleetbase\Traits\HasPublicId;
use Fleetbase\Traits\HasUuid;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * LogiVibe: per-client bearer token for the WMS order intake API
 * (`POST /v1/integrations/wms/orders`). Issued with `fleetops:wms-token issue`.
 *
 * Only the SHA-256 hash of the token is stored; the plain text is printed once
 * when the token is issued. A token is bound to exactly one customer Contact, so
 * the intake controller resolves the customer from the token instead of from
 * the `customer.id` in the request body.
 */
class WmsIntegrationToken extends Model
{
    use HasUuid;
    use HasPublicId;

    /** Plain-text tokens start with this so they are recognisable in logs and configs. */
    public const PLAIN_TEXT_PREFIX = 'wms_';

    /** Random part of the plain-text token (alphanumeric characters). */
    public const PLAIN_TEXT_RANDOM_LENGTH = 48;

    /**
     * The database table used by the model.
     *
     * @var string
     */
    protected $table = 'wms_integration_tokens';

    /**
     * The type of public Id to generate.
     *
     * @var string
     */
    protected $publicIdType = 'wms_token';

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'company_uuid',
        'contact_uuid',
        'created_by_uuid',
        'name',
        'token_hash',
        'token_prefix',
        'last_used_at',
        'revoked_at',
        'meta',
    ];

    /**
     * The attributes excluded from the model's JSON form.
     *
     * @var array
     */
    protected $hidden = ['token_hash'];

    /**
     * The attributes that should be cast to native types.
     *
     * @var array
     */
    protected $casts = [
        'meta'         => Json::class,
        'last_used_at' => 'datetime',
        'revoked_at'   => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_uuid', 'uuid');
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'contact_uuid', 'uuid');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_uuid', 'uuid');
    }

    /**
     * Hash used for storage and lookup of a plain-text token.
     */
    public static function hashPlainTextToken(string $plainTextToken): string
    {
        return hash('sha256', $plainTextToken);
    }

    /**
     * Generate a new plain-text token.
     */
    public static function generatePlainTextToken(): string
    {
        return static::PLAIN_TEXT_PREFIX . Str::random(static::PLAIN_TEXT_RANDOM_LENGTH);
    }

    /**
     * Issue a token for a customer contact.
     *
     * @return array{0: static, 1: string} the stored token and its plain text (shown once, never stored)
     */
    public static function issueFor(Contact $contact, ?string $name = null, ?string $createdByUuid = null): array
    {
        $plainTextToken = static::generatePlainTextToken();

        $token = static::create([
            'company_uuid'    => $contact->company_uuid,
            'contact_uuid'    => $contact->uuid,
            'created_by_uuid' => $createdByUuid,
            'name'            => $name,
            'token_hash'      => static::hashPlainTextToken($plainTextToken),
            'token_prefix'    => substr($plainTextToken, 0, strlen(static::PLAIN_TEXT_PREFIX) + 8),
        ]);

        return [$token, $plainTextToken];
    }

    /**
     * Find the token record for a plain-text token (revoked or not).
     */
    public static function findByPlainTextToken(?string $plainTextToken): ?self
    {
        if ($plainTextToken === null || $plainTextToken === '') {
            return null;
        }

        return static::where('token_hash', static::hashPlainTextToken($plainTextToken))->first();
    }

    public function isRevoked(): bool
    {
        return $this->revoked_at !== null;
    }

    public function isActive(): bool
    {
        return !$this->isRevoked();
    }

    /**
     * Revoke the token; requests using it are rejected with 401 from now on.
     */
    public function revoke(): bool
    {
        if ($this->isRevoked()) {
            return true;
        }

        $this->revoked_at = now();

        return $this->save();
    }

    /**
     * Record that the token authenticated a request. Best effort — never fails the request.
     */
    public function markUsed(): void
    {
        try {
            static::query()->whereKey($this->getKey())->update(['last_used_at' => now()]);
        } catch (\Throwable $e) {
            Log::warning('[WMS API] Could not update last_used_at on integration token', [
                'token'  => $this->public_id,
                'error'  => $e->getMessage(),
            ]);
        }
    }

    /**
     * The customer this token acts for: the bound Contact, provided it still is a
     * customer of the token's company. Null when the contact was removed.
     */
    public function resolveCustomer(): ?Contact
    {
        return Contact::where('uuid', $this->contact_uuid)
            ->where('company_uuid', $this->company_uuid)
            ->where('type', 'customer')
            ->first();
    }
}
