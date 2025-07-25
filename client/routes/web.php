<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\LeadController;
use App\Http\Controllers\AnalyticsController;
use Illuminate\Support\Facades\Route;

Route::middleware(['web'])->group(function () {
    Route::get('/', fn() => redirect()->route('login'))->name('home');

    Route::get('/login', [AuthController::class, 'showLoginForm'])->name('login');
    Route::get('/connect', [AuthController::class, 'redirectToBitrix'])->name('connect');
    Route::get('/auth/callback', [AuthController::class, 'handleCallback'])->name('auth.callback');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    Route::middleware(['auth.bitrix'])->group(function () {
        Route::get('/leads', [LeadController::class, 'index'])->name('leads.index');
        Route::get('/leads/create', [LeadController::class, 'create'])->name('leads.create');
        Route::post('/leads', [LeadController::class, 'store'])->name('leads.store');
        Route::get('/leads/{id}', [LeadController::class, 'show'])->name('leads.show');
        Route::get('/leads/{id}/edit', [LeadController::class, 'edit'])->name('leads.edit');
        Route::patch('/leads/{id}', [LeadController::class, 'update'])->name('leads.update');
        Route::delete('/leads/{id}', [LeadController::class, 'destroy'])->name('leads.destroy');
        Route::get('/leads/webhook/logs', [LeadController::class, 'webhookLogs'])->name('leads.webhook_logs');

        Route::get('/analytics', [AnalyticsController::class, 'index'])->name('analytics.index');
    });
});


