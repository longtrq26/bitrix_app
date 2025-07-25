<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class AnalyticsController extends Controller
{
    public function index()
    {
        $domain = Session::get('domain');
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$domain || !$sessionToken || !$memberId) {
            Log::warning('Authentication required for analytics', ['memberId' => $memberId ?? 'N/A']);
            return redirect('/login')->with('error', 'Yêu cầu xác thực');
        }

        try {
            $leadAnalytics = Cache::remember("analytics:leads:{$memberId}", 900, function () use ($memberId) {
                $response = Http::backend()->get('analytics/leads', ['memberId' => $memberId]);

                if (!$response->successful()) {
                    Log::error('Failed to fetch lead analytics', [
                        'status' => $response->status(),
                        'body' => $response->body(),
                    ]);
                    return [];
                }
                return $response->json() ?? [];
            });

            $dealAnalytics = Cache::remember("analytics:deals:{$memberId}", 900, function () use ($memberId) {
                $response = Http::backend()->get('analytics/deals', ['memberId' => $memberId]);

                if (!$response->successful()) {
                    Log::error('Failed to fetch deal analytics', [
                        'status' => $response->status(),
                        'body' => $response->body(),
                    ]);
                    return [];
                }
                return $response->json() ?? [];
            });

            $taskAnalytics = Cache::remember("analytics:tasks:{$memberId}", 900, function () use ($memberId) {
                $response = Http::backend()->get('analytics/tasks', ['memberId' => $memberId]);

                if (!$response->successful()) {
                    Log::error('Failed to fetch task analytics', [
                        'status' => $response->status(),
                        'body' => $response->body(),
                    ]);
                    return [];
                }
                return $response->json() ?? [];
            });

            Log::info('Fetched analytics data', [
                'memberId' => $memberId,
                'leadCount' => array_sum($leadAnalytics),
                'dealCount' => count($dealAnalytics['revenueByDay'] ?? []),
                'taskCount' => array_sum($taskAnalytics),
            ]);

            return view('analytics.index', compact('leadAnalytics', 'dealAnalytics', 'taskAnalytics'));

        } catch (\Exception $e) {
            Log::error('Failed to fetch analytics data', [
                'memberId' => $memberId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return view('analytics.index', [
                'leadAnalytics' => [],
                'dealAnalytics' => [],
                'taskAnalytics' => [],
            ])->with('error', 'Không thể tải dữ liệu analytics: ' . $e->getMessage());
        }
    }
}