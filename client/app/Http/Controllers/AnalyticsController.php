<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AnalyticsController extends Controller
{
    public function index()
    {
        $domain = Session::get('domain');
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$domain || !$sessionToken || !$memberId) {
            return redirect('/login')->withErrors(['msg' => 'Authentication required']);
        }

        try {
            // Gọi API lead analytics
            $leadAnalyticsResponse = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . 'analytics/leads?memberId=' . $memberId);

            // Gọi API deal analytics
            $dealAnalyticsResponse = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . 'analytics/deals?memberId=' . $memberId);

            // Gọi API task analytics
            $taskAnalyticsResponse = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . 'analytics/tasks?memberId=' . $memberId);

            $leadAnalytics = $leadAnalyticsResponse->json() ?? [];
            $dealAnalytics = $dealAnalyticsResponse->json() ?? [];
            $taskAnalytics = $taskAnalyticsResponse->json() ?? [];

            Log::debug('Lead Analytics', $leadAnalytics ?? []);
            Log::debug('Deal Analytics', $dealAnalytics ?? []);
            Log::debug('Task Analytics raw', ['raw' => $taskAnalyticsResponse->body()]);
            Log::debug('Task Analytics', $taskAnalytics ?? []);
            Log::debug('Deal Analytics raw', ['body' => $dealAnalyticsResponse->body()]);
            Log::debug('Task Analytics raw', ['body' => $taskAnalyticsResponse->body()]);


            return view('analytics.index', compact('leadAnalytics', 'dealAnalytics', 'taskAnalytics'));

        } catch (\Exception $e) {
            Log::error('Failed to fetch analytics data', ['error' => $e->getMessage()]);
            return view('analytics.index', [
                'leadAnalytics' => [],
                'dealAnalytics' => [],
                'taskAnalytics' => [],
            ])->with('error', 'Không thể tải dữ liệu analytics.');
        }

    }
}