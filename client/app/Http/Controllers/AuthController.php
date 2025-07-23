<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Session;
use Log;

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
        Session::put('domain', $domain);

        try {
            $response = Http::withOptions(['verify' => false, 'allow_redirects' => false])
                ->get(env('BASE_API_URL') . 'auth/redirect', [
                    'domain' => $domain,
                ]);

            if ($response->status() === 302 && $response->header('Location')) {
                return redirect()->away($response->header('Location'));
            }

            Log::error('Failed to redirect to Bitrix24', ['response' => $response->json()]);
            return redirect('/login')->withErrors(['msg' => 'Không thể redirect tới Bitrix24']);
        } catch (\Exception $e) {
            Log::error('Error redirecting to Bitrix24', ['error' => $e->getMessage()]);
            return redirect('/login')->withErrors(['msg' => 'An error occurred during authentication']);
        }
    }

    public function handleCallback(Request $request)
    {
        $sessionToken = $request->query('session');
        if (!$sessionToken) {
            Log::error('Missing session token in callback');
            return redirect('/login')->withErrors(['msg' => 'Session token không hợp lệ']);
        }

        try {
            $response = Http::withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . 'auth/member', [
                    'session' => $sessionToken,
                ]);

            if ($response->failed()) {
                Log::error('Failed to fetch member data', ['response' => $response->json()]);
                return redirect('/login')->withErrors(['msg' => 'Session token không hợp lệ']);
            }

            $memberId = $response->json('memberId');
            if (!$memberId) {
                Log::error('Missing memberId in auth response');
                return redirect('/login')->withErrors(['msg' => 'Không thể lấy member ID']);
            }

            Session::put('session_token', $sessionToken);
            Session::put('member_id', $memberId);

            return redirect('/leads');
        } catch (\Exception $e) {
            Log::error('Error handling OAuth callback', ['error' => $e->getMessage()]);
            return redirect('/login')->withErrors(['msg' => 'An error occurred during authentication']);
        }
    }
}
