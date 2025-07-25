<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateBitrix
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next)
    {
        $domain = $request->session()->get('domain');
        $sessionToken = $request->session()->get('session_token');
        $memberId = $request->session()->get('member_id');

        if (!$domain || !$sessionToken || !$memberId) {
            Log::error('Authentication required: Missing domain, session_token, or member_id', [
                'path' => $request->path(),
            ]);
            return redirect('/login')->withErrors(['msg' => 'Authentication required']);
        }

        return $next($request);
    }
}
