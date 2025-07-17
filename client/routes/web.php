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
    Route::get('/leads/create', [LeadController::class, 'create']);
    Route::post('/leads', [LeadController::class, 'store']);
    Route::get('/leads/{id}/edit', [LeadController::class, 'edit']);
    Route::post('/leads/{id}/update', [LeadController::class, 'update']);
    Route::delete('/leads/{id}', [LeadController::class, 'destroy']);
    Route::get('/leads/json', [LeadController::class, 'json'])->name('leads.json');
});