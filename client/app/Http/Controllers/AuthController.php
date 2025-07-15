<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Session;

class AuthController extends Controller
{
    public function showLoginForm()
    {
        return view('auth.login');
    }

    public function redirectToBitrix(Request $request)
    {
        $request->validate([
            'domain' => ['required', 'regex:/^[a-zA-Z0-9.-]+\.bitrix24\.(vn|com)$/']
        ]);

        $domain = $request->input('domain');

        $response = Http::withOptions(['verify' => false, 'allow_redirects' => false])
            ->get(env('BASE_API_URL') . '/auth/redirect', [
                'domain' => $domain
            ]);

        if ($response->status() === 302 && $response->header('Location')) {
            return redirect()->away($response->header('Location'));
        }

        return redirect('/login')->withErrors(['msg' => 'Không thể redirect tới Bitrix24']);
    }

    public function handleCallback(Request $request)
    {
        $sessionToken = $request->query('session');

        $response = Http::withOptions(['verify' => false])
            ->get(env('BASE_API_URL') . '/auth/member', [
                'session' => $sessionToken
            ]);

        if ($response->failed()) {
            return redirect('/login')->withErrors(['msg' => 'Session token không hợp lệ']);
        }

        Session::put('session_token', $sessionToken);
        Session::put('member_id', $response->json('memberId'));

        // Gọi thêm domain
        $domainRes = Http::withOptions(['verify' => false])
            ->get(env('BASE_API_URL') . '/auth/domain', [
                'memberId' => $response->json('memberId')
            ]);

        if ($domainRes->ok()) {
            Session::put('domain', $domainRes->body());
        }

        return redirect('/leads');
    }
}
