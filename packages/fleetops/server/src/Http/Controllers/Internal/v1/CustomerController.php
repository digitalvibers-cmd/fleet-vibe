<?php

namespace Fleetbase\FleetOps\Http\Controllers\Internal\v1;

use Fleetbase\FleetOps\Mail\CustomerCredentialsMail;
use Fleetbase\FleetOps\Models\Contact;
use Fleetbase\FleetOps\Support\CustomerAccessRevoker;
use Fleetbase\Http\Controllers\Controller;
use Fleetbase\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class CustomerController extends Controller
{
    /**
     * Resets the password for a specified customer and optionally sends the new credentials via email.
     *
     * This method handles the process of resetting a customer's password. It performs the following actions:
     * 1. Validates the presence of the customer identifier.
     * 2. Ensures that the provided password and confirmation password match.
     * 3. Retrieves the customer based on the provided UUID, company session, and customer type.
     * 4. Loads the associated user account or creates one if it doesn't exist.
     * 5. Updates the user's password.
     * 6. Optionally sends the new password to the customer's email address if opted in.
     *
     * **Usage Example:**
     * ```php
     * // In a controller method
     * public function someControllerMethod(Request $request)
     * {
     *     return $this->resetPassword($request);
     * }
     * ```
     *
     * **Request Parameters:**
     * - `customer` (string): The UUID of the customer whose password is to be reset.
     * - `password` (string): The new password for the customer.
     * - `password_confirmation` (string): Confirmation of the new password.
     * - `send_credentials` (boolean): Flag indicating whether to send the new credentials via email.
     *
     * **Response:**
     * - On success: Returns a JSON response with `['status' => 'ok']`.
     * - On failure: Returns a JSON error response with an appropriate error message.
     *
     * **Possible Error Responses:**
     * - `'No customer specified to change password for.'`
     * - `'Passwords do not match.'`
     * - `'Customer not found to change password for.'`
     * - `'Unable to reset customer credentials.'`
     *
     * @param Request $request the HTTP request instance containing input data
     *
     * @return \Illuminate\Http\JsonResponse a JSON response indicating the result of the password reset operation
     *
     * @throws \Illuminate\Validation\ValidationException if validation fails
     * @throws \Exception                                 if unexpected errors occur during the password reset process
     *
     * @see \Fleetbase\FleetOps\\Models\Contact
     * @see \Fleetbase\FleetOps\\Mail\CustomerCredentialsMail
     */
    public function resetCredentials(Request $request)
    {
        // LogiVibe: only admins or operators with the "iam create user" permission may
        // reset customer portal credentials. The console UI gates this too, but the API
        // must not trust the frontend alone.
        $actor = $request->user() ?? (session('user') ? User::find(session('user')) : null);
        if ($actor && !$this->canResetCustomerCredentials($actor)) {
            return response()->error('You are not authorized to reset customer credentials.', 403);
        }

        $customerId      = $request->input('customer');
        $password        = $request->input('password');
        $confirmPassword = $request->input('password_confirmation');
        $sendCredentials = $request->boolean('send_credentials');

        if (!$customerId) {
            return response()->error('No customer specified to change password for.');
        }

        // LogiVibe: when no password is supplied the console asks us to auto-generate
        // one (matching the account-creation flow in CustomerContactObserver) and email
        // it to the customer — otherwise the operator would never see the new password.
        $autoGenerate = empty($password);
        if ($autoGenerate) {
            $password        = Str::random(12);
            $sendCredentials = true;
        } elseif ($password !== $confirmPassword) {
            return response()->error('Passwords do not match.');
        }

        $customer = Contact::where(['uuid' => $customerId, 'company_uuid' => session('company'), 'type' => 'customer'])->first();
        if (!$customer) {
            return response()->error('Customer not found to change password for.');
        }

        // LogiVibe: reset operates only on an existing portal account; we never call
        // createUser() here so this flow can never enter the account-creation /
        // assignCompany() path (which would otherwise dispatch a console UserInvited).
        $user = $customer->user_uuid ? User::where('uuid', $customer->user_uuid)->first() : null;
        if (!$user) {
            return response()->error('Customer has no portal account to reset.');
        }

        // Change password
        $user->changePassword($password);

        // LogiVibe: revoke all existing Sanctum tokens so prior portal sessions
        // are invalidated; the customer must log in again with the new password.
        app(CustomerAccessRevoker::class)->revokeTokens($user);

        // Send credentials to customer if opted
        if ($sendCredentials) {
            Mail::to($user)->send(new CustomerCredentialsMail($password, $customer));
        }

        return response()->json(['status' => 'ok']);
    }

    /**
     * Whether the acting user may reset customer portal credentials.
     *
     * Mirrors the console ability check (packages/ember-core .../abilities/dynamic.js):
     * an admin bypass plus the literal/wildcard permission NAMES. We inspect permission
     * names via getAllPermissions() rather than $actor->can(), because Gate/->can() is
     * guard/team-scoped and unreliably returns false here even when the user holds the
     * permission (verified on dev: admins with `iam create user` still got ->can() = false).
     */
    private function canResetCustomerCredentials(User $actor): bool
    {
        if (method_exists($actor, 'isAdmin') && $actor->isAdmin()) {
            return true;
        }

        try {
            $permissionNames = $actor->getAllPermissions()->pluck('name');
        } catch (\Throwable $e) {
            // If permissions can't be resolved, defer to the console UI gate rather
            // than locking out a legitimate operator.
            return true;
        }

        return $permissionNames->contains('iam create user')
            || $permissionNames->contains('iam * user')
            || $permissionNames->contains('iam *');
    }
}
