<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * LogiVibe: per-client bearer tokens for POST /v1/integrations/wms/orders.
 *
 * Each token is bound to one customer Contact. When a request authenticates
 * with such a token the WMS controller takes the customer from the token
 * instead of trusting `customer.id` in the body, so one client can never
 * create orders on behalf of another. The shared `.env` token
 * (`WMS_INTEGRATION_TOKEN`) is untouched and keeps working as before.
 */
return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('wms_integration_tokens', function (Blueprint $table) {
            $table->increments('id');
            $table->uuid('uuid')->index();
            $table->string('public_id')->nullable()->index();
            $table->foreignUuid('company_uuid')->constrained('companies', 'uuid')->cascadeOnDelete();
            $table->uuid('contact_uuid')->index();
            $table->uuid('created_by_uuid')->nullable()->index();
            $table->string('name')->nullable();
            // sha256 hex of the plain-text token; the plain text is shown once and never stored
            $table->string('token_hash', 64)->unique();
            // first characters of the plain text, to recognise a token in listings
            $table->string('token_prefix', 16)->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('revoked_at')->nullable()->index();
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('wms_integration_tokens');
        Schema::enableForeignKeyConstraints();
    }
};
