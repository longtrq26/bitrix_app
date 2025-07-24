<?php

namespace App\Providers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Log; // Import Log facade
use Illuminate\Support\ServiceProvider;

class HttpServiceProvider extends ServiceProvider
{

    public function register()
    {
    }


    public function boot()
    {
        Http::macro('backend', function () {
            $sessionToken = Session::get('session_token');
            $memberId = Session::get('member_id');

            $headers = [];
            if ($sessionToken) {
                $headers['X-Session-Token'] = $sessionToken;
                Log::debug('Attaching X-Session-Token to backend request.', ['session_token_partial' => substr($sessionToken, 0, 8) . '...']);
            } else {
                Log::debug('No session_token found in session for backend request.');
            }

            if ($memberId) {
                $headers['X-Member-Id'] = $memberId;
                Log::debug('Attaching X-Member-Id to backend request.', ['member_id' => $memberId]);
            } else {
                Log::debug('No member_id found in session for backend request.');
            }

            return Http::withHeaders($headers)
                ->baseUrl(env('BASE_API_URL'))
                ->withOptions(['verify' => false]);
        });
    }
}