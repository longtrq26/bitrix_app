<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;

class EnsureSessionToken
{
    public function handle(Request $request, Closure $next)
    {
        if (!Session::has('session_token')) {
            return redirect()->route('auth.login');
        }

        return $next($request);
    }
}
