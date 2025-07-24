<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class Authenticate
{
    public function handle(Request $request, Closure $next)
    {
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');
        $domain = Session::get('domain');

        if (!$sessionToken || !$memberId || !$domain) {
            Log::error('Authentication required: Missing domain, session_token, or member_id', [
                'session_token' => $sessionToken ? substr($sessionToken, 0, 8) . '...' : null,
                'member_id' => $memberId,
                'domain' => $domain,
            ]);
            return redirect('/login')->withErrors(['msg' => 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.']);
        }

        return $next($request);
    }
}
