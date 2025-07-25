<?php

namespace App\Http\Controllers;

use GuzzleHttp\Client;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Log;

class LeadController extends Controller
{
    protected $client;

    public function __construct()
    {
        $this->client = new Client(['base_uri' => env('BASE_API_URL')]);
    }

    public function index(Request $request)
    {
        $domain = $request->session()->get('domain');
        $sessionToken = $request->session()->get('session_token');
        $memberId = $request->session()->get('member_id');

        $query = array_merge(
            $request->only(['find', 'status', 'source', 'date', 'sort', 'page', 'limit']),
            ['domain' => $domain]
        );
        Log::debug('Query parameters received in LeadController', ['query' => $query, 'memberId' => $memberId]);

        try {
            $response = Http::backend()->get('leads', $query);

            if ($response->failed()) {
                Log::error('Failed to fetch leads', [
                    'memberId' => $memberId,
                    'response' => $response->json(),
                    'status' => $response->status(),
                ]);
                return back()->withErrors(['error' => $response->json()['message'] ?? 'Failed to fetch leads']);
            }

            $payload = $response->json() ?? [];
            $leads = $payload['leads'] ?? [];
            $fields = $payload['fields'] ?? [];
            $statuses = $payload['statuses'] ?? [];
            $sources = $payload['sources'] ?? [];
            $total = $payload['total'] ?? 0;
            $currentPage = $payload['page'] ?? 1;
            $perPage = $payload['limit'] ?? 10;

            $recentWebhooks = $this->checkRecentWebhooks($sessionToken, $memberId);

            Log::info('Fetched leads', [
                'memberId' => $memberId,
                'lead_count' => count($leads),
                'statuses_count' => count($statuses),
                'sources_count' => count($sources),
                'recent_webhooks' => $recentWebhooks,
            ]);

            return view('leads.index', compact('leads', 'fields', 'statuses', 'sources', 'recentWebhooks', 'total', 'currentPage', 'perPage'));
        } catch (\Exception $e) {
            Log::error('Error fetching leads', [
                'memberId' => $memberId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return back()->withErrors(['error' => 'An error occurred while fetching leads: ' . $e->getMessage()]);
        }
    }

    public function create(Request $request)
    {
        $domain = $request->session()->get('domain');
        $sessionToken = $request->session()->get('session_token');
        $memberId = $request->session()->get('member_id');

        try {
            $response = Http::backend()->get('leads', ['domain' => $domain]);

            if ($response->failed()) {
                Log::error('Failed to fetch statuses and sources for create lead', [
                    'memberId' => $memberId,
                    'response' => $response->json(),
                    'status' => $response->status(),
                ]);
                return back()->withErrors(['error' => $response->json()['message'] ?? 'Failed to fetch statuses and sources']);
            }

            $payload = $response->json() ?? [];
            $statuses = $payload['statuses'] ?? [];
            $sources = $payload['sources'] ?? [];

            Log::info('Fetched data for create lead form', [
                'memberId' => $memberId,
                'statuses_count' => count($statuses),
                'sources_count' => count($sources),
            ]);

            return view('leads.create', compact('statuses', 'sources'));
        } catch (\Exception $e) {
            Log::error('Error fetching data for create lead form', [
                'memberId' => $memberId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return back()->withErrors(['error' => 'An error occurred while loading create lead form: ' . $e->getMessage()]);
        }
    }

    public function store(Request $request)
    {
        $domain = $request->session()->get('domain');
        $sessionToken = $request->session()->get('session_token');
        $memberId = $request->session()->get('member_id');

        $request->validate([
            'TITLE' => 'required|string|max:100',
            'NAME' => 'nullable|string',
            'EMAIL' => 'nullable|email',
            'PHONE' => 'nullable|string',
            'STATUS_ID' => 'nullable|string',
            'SOURCE_ID' => 'nullable|string',
            'COMMENTS' => 'nullable|string|max:1000',
        ]);

        try {
            $response = Http::backend()->post('leads', array_merge($request->all(), ['domain' => $domain]));

            if ($response->successful()) {
                Log::info('Lead created successfully', ['memberId' => $memberId, 'response' => $response->json()]);
                return redirect()->route('leads.index')->with('success', 'Lead created successfully');
            }

            Log::error('Failed to create lead', [
                'memberId' => $memberId,
                'response' => $response->json(),
                'status' => $response->status(),
            ]);
            return back()->withErrors(['error' => $response->json()['message'] ?? 'Failed to create lead']);
        } catch (\Exception $e) {
            Log::error('Error creating lead', [
                'memberId' => $memberId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return back()->withErrors(['error' => 'An error occurred while creating lead: ' . $e->getMessage()]);
        }
    }

    public function show(Request $request, $id)
    {
        $domain = $request->session()->get('domain');
        $sessionToken = $request->session()->get('session_token');
        $memberId = $request->session()->get('member_id');

        try {
            $leadResponse = Http::backend()->get("leads/{$id}");
            if ($leadResponse->failed()) {
                Log::error('Failed to fetch lead details', [
                    'memberId' => $memberId,
                    'leadId' => $id,
                    'response' => $leadResponse->json(),
                    'status' => $leadResponse->status(),
                ]);
                return back()->withErrors(['error' => $leadResponse->json()['message'] ?? 'Failed to fetch lead details']);
            }

            $tasksResponse = Http::backend()->get("leads/{$id}/tasks");
            $dealsResponse = Http::backend()->get("leads/{$id}/deals");
            $listResponse = Http::backend()->get('leads', ['domain' => $domain]);

            if ($listResponse->failed()) {
                Log::error('Failed to fetch statuses and sources', [
                    'memberId' => $memberId,
                    'response' => $listResponse->json(),
                    'status' => $listResponse->status(),
                ]);
            }

            $lead = $leadResponse->json() ?? [];
            $tasks = $tasksResponse->json() ?? [];
            $deals = $dealsResponse->json() ?? [];
            $statuses = $listResponse->json()['statuses'] ?? [];
            $sources = $listResponse->json()['sources'] ?? [];

            $recentWebhooks = $this->checkRecentWebhooks($sessionToken, $memberId, $id);

            Log::info('Fetched lead details', [
                'memberId' => $memberId,
                'leadId' => $id,
                'task_count' => count($tasks),
                'deal_count' => count($deals),
                'recent_webhooks' => $recentWebhooks,
            ]);

            return view('leads.show', compact('lead', 'tasks', 'deals', 'id', 'statuses', 'sources', 'recentWebhooks'));
        } catch (\Exception $e) {
            Log::error('Error fetching lead details', [
                'memberId' => $memberId,
                'leadId' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return back()->withErrors(['error' => 'An error occurred while fetching lead details: ' . $e->getMessage()]);
        }
    }

    public function edit(Request $request, $id)
    {
        $domain = $request->session()->get('domain');
        $sessionToken = $request->session()->get('session_token');
        $memberId = $request->session()->get('member_id');

        try {
            $leadResponse = Http::backend()->get("leads/{$id}");
            if ($leadResponse->failed()) {
                Log::error('Failed to fetch lead details for edit', [
                    'memberId' => $memberId,
                    'leadId' => $id,
                    'response' => $leadResponse->json(),
                    'status' => $leadResponse->status(),
                ]);
                return back()->withErrors(['error' => $leadResponse->json()['message'] ?? 'Failed to fetch lead details']);
            }

            $listResponse = Http::backend()->get('leads', ['domain' => $domain]);
            if ($listResponse->failed()) {
                Log::error('Failed to fetch statuses and sources for edit lead', [
                    'memberId' => $memberId,
                    'response' => $listResponse->json(),
                    'status' => $listResponse->status(),
                ]);
            }

            $lead = $leadResponse->json() ?? [];
            $statuses = $listResponse->successful() ? $listResponse->json()['statuses'] : [];
            $sources = $listResponse->successful() ? $listResponse->json()['sources'] : [];

            Log::info('Fetched data for edit lead form', [
                'memberId' => $memberId,
                'leadId' => $id,
                'statuses_count' => count($statuses),
                'sources_count' => count($sources),
            ]);

            return view('leads.edit', compact('lead', 'id', 'statuses', 'sources'));
        } catch (\Exception $e) {
            Log::error('Error fetching data for edit lead form', [
                'memberId' => $memberId,
                'leadId' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return back()->withErrors(['error' => 'An error occurred while loading edit lead form: ' . $e->getMessage()]);
        }
    }

    public function update(Request $request, $id)
    {
        $domain = $request->session()->get('domain');
        $sessionToken = $request->session()->get('session_token');
        $memberId = $request->session()->get('member_id');

        $request->validate([
            'TITLE' => 'required|string|max:100',
            'NAME' => 'nullable|string',
            'EMAIL' => 'nullable|email',
            'PHONE' => 'nullable|string',
            'STATUS_ID' => 'nullable|string',
            'SOURCE_ID' => 'nullable|string',
            'COMMENTS' => 'nullable|string|max:1000',
        ]);

        try {
            $response = Http::backend()->patch("leads/{$id}", array_merge($request->all(), ['domain' => $domain]));

            if ($response->successful()) {
                Log::info('Lead updated successfully', ['memberId' => $memberId, 'leadId' => $id, 'response' => $response->json()]);
                return redirect()->route('leads.index')->with('success', 'Lead updated successfully');
            }

            Log::error('Failed to update lead', [
                'memberId' => $memberId,
                'leadId' => $id,
                'response' => $response->json(),
                'status' => $response->status(),
            ]);
            return back()->withErrors(['error' => $response->json()['message'] ?? 'Failed to update lead']);
        } catch (\Exception $e) {
            Log::error('Error updating lead', [
                'memberId' => $memberId,
                'leadId' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return back()->withErrors(['error' => 'An error occurred while updating lead: ' . $e->getMessage()]);
        }
    }

    public function destroy(Request $request, $id)
    {
        $domain = $request->session()->get('domain');
        $sessionToken = $request->session()->get('session_token');
        $memberId = $request->session()->get('member_id');

        try {
            $response = Http::backend()->delete("leads/{$id}");

            if ($response->successful()) {
                Log::info('Lead deleted successfully', ['memberId' => $memberId, 'leadId' => $id, 'response' => $response->json()]);
                return redirect()->route('leads.index')->with('success', 'Lead deleted successfully');
            }

            Log::error('Failed to delete lead', [
                'memberId' => $memberId,
                'leadId' => $id,
                'response' => $response->json(),
                'status' => $response->status(),
            ]);
            return back()->withErrors(['error' => $response->json()['message'] ?? 'Failed to delete lead']);
        } catch (\Exception $e) {
            Log::error('Error deleting lead', [
                'memberId' => $memberId,
                'leadId' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return back()->withErrors(['error' => 'An error occurred while deleting lead: ' . $e->getMessage()]);
        }
    }

    public function webhookLogs(Request $request)
    {
        $sessionToken = $request->session()->get('session_token');
        $memberId = $request->session()->get('member_id');
        $page = $request->query('page', 1);
        $limit = $request->query('limit', 10);
        $event = $request->query('event');
        $leadId = $request->query('leadId');

        try {
            $params = ['page' => $page, 'limit' => $limit];
            if ($event)
                $params['event'] = $event;
            if ($leadId)
                $params['leadId'] = $leadId;

            $response = Http::backend()->get("webhook/logs", $params);

            $data = $response->successful() ? $response->json() : [];
            $logs = $data['logs'] ?? [];
            $total = $data['total'] ?? 0;
            $currentPage = $data['page'] ?? 1;
            $perPage = $data['limit'] ?? 10;
            $totalPages = $data['totalPages'] ?? 1;

            Log::info('Fetched webhook logs', [
                'memberId' => $memberId,
                'log_count' => count($logs),
                'page' => $currentPage,
            ]);

            return view('leads.webhook_logs', compact('logs', 'total', 'currentPage', 'perPage', 'totalPages'));
        } catch (\Exception $e) {
            Log::error('Failed to fetch webhook logs', [
                'memberId' => $memberId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return view('leads.webhook_logs', [
                'logs' => [],
                'total' => 0,
                'currentPage' => 1,
                'perPage' => 10,
                'totalPages' => 1,
            ])->with('error', 'Không thể tải log webhook.');
        }
    }

    protected function checkRecentWebhooks($sessionToken, $memberId, $leadId = null)
    {
        try {
            $params = ['limit' => 100];
            if ($leadId) {
                $params['leadId'] = $leadId;
            }
            $response = Http::backend()->get('webhook/logs', $params);

            if ($response->failed()) {
                Log::error('Failed to check recent webhooks', [
                    'memberId' => $memberId,
                    'leadId' => $leadId,
                    'response' => $response->json(),
                    'status' => $response->status(),
                ]);
                return 0;
            }

            $logs = $response->json()['logs'] ?? [];
            $recentCount = count(array_filter($logs, function ($log) use ($leadId) {
                try {
                    $payload = json_decode($log['payload'], true);
                    $isRecent = \Carbon\Carbon::parse($log['createdAt'])->gt(now()->subMinutes(5));
                    if ($leadId) {
                        return $isRecent &&
                            $log['event'] === 'ONCRMLEADUPDATE' &&
                            isset($payload['ID']) &&
                            $payload['ID'] === $leadId;
                    }
                    return $isRecent && in_array($log['event'], ['ONCRMLEADADD', 'ONCRMLEADUPDATE']);
                } catch (\Exception $e) {
                    Log::warn('Failed to parse webhook payload', [
                        'logId' => $log['id'],
                        'error' => $e->getMessage(),
                    ]);
                    return false;
                }
            }));

            Log::debug('Checked recent webhooks', [
                'memberId' => $memberId,
                'leadId' => $leadId,
                'recentCount' => $recentCount,
            ]);

            return $recentCount;
        } catch (\Exception $e) {
            Log::error('Error checking recent webhooks', [
                'memberId' => $memberId,
                'leadId' => $leadId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return 0;
        }
    }
}