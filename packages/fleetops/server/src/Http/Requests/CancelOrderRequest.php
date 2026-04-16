<?php

namespace Fleetbase\FleetOps\Http\Requests;

use Fleetbase\Http\Requests\FleetbaseRequest;

class CancelOrderRequest extends FleetbaseRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize()
    {
        return request()->session()->has('api_credential');
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        return [
            'order' => [
                'required',
                function ($attribute, $value, $fail) {
                    $exists = \Fleetbase\FleetOps\Models\Order::where('uuid', $value)
                        ->orWhere('public_id', $value)
                        ->exists();
                    if (!$exists) {
                        $fail('The selected order does not exist.');
                    }
                },
            ],
        ];
    }
}
