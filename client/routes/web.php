<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\LeadController;
use App\Http\Controllers\AnalyticsController;

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/login', [AuthController::class, 'showLoginForm']);
Route::get('/connect', [AuthController::class, 'redirectToBitrix']);
Route::get('/auth/callback', [AuthController::class, 'handleCallback']);

Route::middleware('web')->group(function () {
    Route::get('/leads', [LeadController::class, 'index'])->name('leads.index');
    Route::get('/leads/create', [LeadController::class, 'create'])->name('leads.create');
    Route::post('/leads', [LeadController::class, 'store'])->name('leads.store');
    Route::get('/leads/{id}', [LeadController::class, 'show'])->name('leads.show');
    Route::get('/leads/{id}/edit', [LeadController::class, 'edit'])->name('leads.edit');
    Route::patch('/leads/{id}', [LeadController::class, 'update'])->name('leads.update');
    Route::delete('/leads/{id}', [LeadController::class, 'destroy'])->name('leads.destroy');
    Route::get('/leads/webhook/logs', [LeadController::class, 'webhookLogs'])->name('leads.webhook_logs');
});

Route::middleware("web")->get('/analytics', [AnalyticsController::class, 'index'])->name('analytics.index');