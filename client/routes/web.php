<?php

use App\Http\Controllers\LeadController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/login', function () {
    return view('auth.login'); // form nhập domain
});

Route::post('/login/redirect', function (\Illuminate\Http\Request $request) {
    $domain = $request->input('domain');
    return redirect("http://localhost:3001/api/auth/redirect?domain=$domain");
});

Route::get('/auth/callback', function (\Illuminate\Http\Request $request) {
    $memberId = $request->input('member_id');

    Log::info('🔁 [OAuth Callback] Received member_id: ' . $memberId);

    $response = Http::get("http://localhost:3001/api/auth/domain?memberId=$memberId");

    if ($response->failed()) {
        Log::error('❌ [OAuth Callback] Failed to fetch domain from backend');
        return redirect('/login')->withErrors(['msg' => 'Xác thực thất bại']);
    }

    $domain = $response->body();

    Session::put('member_id', $memberId);
    Session::put('domain', $domain);

    Log::info("✅ [OAuth Callback] Auth success. Domain: $domain");

    return response()->view('debug', compact('memberId', 'domain'));
});



Route::middleware('auth.session')->group(function () {
    Route::get('/leads', [LeadController::class, 'index'])->name('leads.index');
    Route::get('/leads/create', [LeadController::class, 'create'])->name('leads.create');
    Route::post('/leads', [LeadController::class, 'store'])->name('leads.store');
    Route::delete('/leads/{id}', [LeadController::class, 'destroy'])->name('leads.destroy');
});