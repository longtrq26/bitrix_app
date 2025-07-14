<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    protected $backendApiUrl;

    public function __construct()
    {
        $this->backendApiUrl = env('BACKEND_API_URL', 'https://abc55ff5bdf1.ngrok-free.app');
    }

    public function showLoginForm()
    {
        return view('auth.login');
    }

    public function redirectToBitrix(Request $request)
    {
        $request->validate([
            'domain' => 'required|regex:/^[a-zA-Z0-9-]+\.bitrix24\.vn$/',
        ]);

        $domain = $request->input('domain');

        $backendRedirectUrl = "{$this->backendApiUrl}/api/auth/redirect?domain=" . urlencode($domain);

        Log::info('Redirecting user to backend', ['url' => $backendRedirectUrl]);

        return redirect()->away($backendRedirectUrl);
    }

    public function handleCallback(Request $request)
    {
        $sessionToken = $request->query('session');

        if (!$sessionToken) {
            return redirect()->route('auth.login')->withErrors(['msg' => 'Missing session token']);
        }

        Session::put('session_token', $sessionToken);
        Log::info('Session token stored', ['token' => $sessionToken]);

        return redirect()->route('dashboard');
    }
}
