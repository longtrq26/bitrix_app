<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\LeadController;
use App\Http\Controllers\ThemeController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/login', [AuthController::class, 'showLoginForm']);
Route::get('/connect', [AuthController::class, 'redirectToBitrix']);
Route::get('/auth/callback', [AuthController::class, 'handleCallback']);

Route::middleware('web')->group(function () {
    Route::get('/leads', [LeadController::class, 'index']);
});