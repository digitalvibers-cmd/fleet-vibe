<?php

namespace Fleetbase\FleetOps\Http\Controllers\Internal\v1;

use Fleetbase\FleetOps\Http\Requests\Internal\UpdateUserRequest;
use Fleetbase\Http\Controllers\Internal\v1\UserController as BaseUserController;

class UserController extends BaseUserController
{
    public $updateRequest = UpdateUserRequest::class;
}
