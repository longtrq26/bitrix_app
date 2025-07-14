<?php

use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/login', [AuthController::class, 'showLoginForm'])->name('auth.login');
Route::post('/redirect', [AuthController::class, 'redirectToBitrix'])->name('auth.redirect');
Route::get('/auth/callback', [AuthController::class, 'handleCallback'])->name('auth.callback');

Route::middleware('auth.session')->group(function () {
    Route::get('/dashboard', function () {
        return view('dashboard');
    })->name('dashboard');
});