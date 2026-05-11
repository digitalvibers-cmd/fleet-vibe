<?php

namespace Fleetbase\FleetOps\Http\Requests\Internal;

use Fleetbase\Http\Requests\FleetbaseRequest;
use Fleetbase\Rules\EmailDomainExcluded;
use Fleetbase\Rules\ValidPhoneNumber;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FleetbaseRequest
{
    public function authorize(): bool
    {
        return (bool) session('company');
    }

    public function rules(): array
    {
        $userId = $this->route('user') ?? $this->route('id');

        return [
            'user.name'  => ['sometimes', 'min:2', 'max:50'],
            'user.email' => [
                'sometimes',
                'email',
                Rule::unique('users', 'email')
                    ->ignore($userId, 'uuid')
                    ->whereNull('deleted_at'),
                new EmailDomainExcluded(),
            ],
            'user.phone' => [
                'sometimes',
                new ValidPhoneNumber(),
                Rule::unique('users', 'phone')
                    ->ignore($userId, 'uuid')
                    ->whereNull('deleted_at'),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'user.email.unique' => 'An account with this email address already exists',
            'user.phone.unique' => 'An account with this phone number already exists',
        ];
    }
}
