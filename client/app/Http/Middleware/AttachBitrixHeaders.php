<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\Session;

class AttachBitrixHeaders
{
    public function handle($request, Closure $next)
    {
        if (Session::has('session_token') && Session::has('member_id')) {
            $request->headers->set('X-Session-Token', Session::get('session_token'));
            $request->headers->set('X-Member-Id', Session::get('member_id'));
        }

        return $next($request);
    }
}
