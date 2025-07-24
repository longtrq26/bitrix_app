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
        Log::debug('Session in /leads page', Session::all());

        $domain = Session::get('domain');
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$domain || !$sessionToken || !$memberId) {
            Log::error('Authentication required: Missing domain, session_token, or member_id');
            return redirect('/login')->withErrors(['msg' => 'Authentication required']);
        }

        $query = array_merge(
            $request->only(['find', 'status', 'source', 'date', 'sort', 'page', 'limit']),
            ['domain' => $domain]
        );
        Log::debug('Query parameters received in LeadController', ['query' => $query]);

        try {
            $response = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . 'leads', $query);

            if ($response->failed()) {
                Log::error('Failed to fetch leads', [
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
                'lead_count' => count($leads),
                'statuses_count' => count($statuses),
                'sources_count' => count($sources),
                'recent_webhooks' => $recentWebhooks,
            ]);

            return view('leads.index', compact('leads', 'fields', 'statuses', 'sources', 'recentWebhooks', 'total', 'currentPage', 'perPage'));
        } catch (\Exception $e) {
            Log::error('Error fetching leads', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return back()->withErrors(['error' => 'An error occurred while fetching leads: ' . $e->getMessage()]);
        }
    }

    public function create()
    {
        $domain = Session::get('domain');
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$domain || !$sessionToken || !$memberId) {
            Log::error('Authentication required for create lead');
            return redirect('/login')->withErrors(['msg' => 'Authentication required']);
        }

        try {
            // Fetch statuses and sources for dropdowns
            $response = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . 'leads', ['domain' => $domain]);

            if ($response->failed()) {
                Log::error('Failed to fetch statuses and sources for create lead', [
                    'response' => $response->json(),
                    'status' => $response->status(),
                ]);
                return back()->withErrors(['error' => $response->json()['message'] ?? 'Failed to fetch statuses and sources']);
            }

            $payload = $response->json() ?? [];
            $statuses = $payload['statuses'] ?? [];
            $sources = $payload['sources'] ?? [];

            Log::info('Fetched data for create lead form', [
                'statuses_count' => count($statuses),
                'sources_count' => count($sources),
            ]);

            return view('leads.create', compact('statuses', 'sources'));
        } catch (\Exception $e) {
            Log::error('Error fetching data for create lead form', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return back()->withErrors(['error' => 'An error occurred while loading create lead form: ' . $e->getMessage()]);
        }
    }

    public function store(Request $request)
    {
        $domain = Session::get('domain');
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$domain || !$sessionToken || !$memberId) {
            Log::error('Authentication required for store lead');
            return redirect('/login')->withErrors(['msg' => 'Authentication required']);
        }

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
            $response = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->post(env('BASE_API_URL') . 'leads', array_merge($request->all(), ['domain' => $domain]));

            if ($response->successful()) {
                Log::info('Lead created successfully', ['response' => $response->json()]);
                return redirect()->route('leads.index')->with('success', 'Lead created successfully');
            }

            Log::error('Failed to create lead', ['response' => $response->json()]);
            return back()->withErrors(['error' => $response->json()['message'] ?? 'Failed to create lead']);
        } catch (\Exception $e) {
            Log::error('Error creating lead', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return back()->withErrors(['error' => 'An error occurred while creating lead: ' . $e->getMessage()]);
        }
    }

    public function show($id)
    {
        $domain = Session::get('domain');
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$domain || !$sessionToken || !$memberId) {
            Log::error('Authentication required for show lead', ['id' => $id]);
            return redirect('/login')->withErrors(['msg' => 'Authentication required']);
        }

        try {
            // Fetch lead details
            $leadResponse = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . "leads/{$id}");

            if ($leadResponse->failed()) {
                Log::error('Failed to fetch lead details', [
                    'id' => $id,
                    'response' => $leadResponse->json(),
                    'status' => $leadResponse->status(),
                ]);
                return back()->withErrors(['error' => $leadResponse->json()['message'] ?? 'Failed to fetch lead details']);
            }

            // Fetch tasks
            $tasksResponse = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . "leads/{$id}/tasks");

            // Fetch deals
            $dealsResponse = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . "leads/{$id}/deals");

            // Fetch statuses and sources for dropdowns
            $listResponse = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . 'leads', ['domain' => $domain]);

            if ($listResponse->failed()) {
                Log::error('Failed to fetch statuses and sources', [
                    'response' => $listResponse->json(),
                    'status' => $listResponse->status(),
                ]);
            }

            $lead = $leadResponse->json() ?? [];
            $tasks = $tasksResponse->json() ?? [];
            $deals = $dealsResponse->json() ?? [];
            $statuses = $listResponse->json()['statuses'] ?? [];
            $sources = $listResponse->json()['sources'] ?? [];

            // Check for recent webhook events for this lead
            $recentWebhooks = $this->checkRecentWebhooks($sessionToken, $memberId, $id);

            Log::info('Fetched lead details', [
                'id' => $id,
                'lead' => $lead,
                'task_count' => count($tasks),
                'deal_count' => count($deals),
                'recent_webhooks' => $recentWebhooks,
            ]);

            return view('leads.show', compact('lead', 'tasks', 'deals', 'id', 'statuses', 'sources', 'recentWebhooks'));
        } catch (\Exception $e) {
            Log::error('Error fetching lead details', ['id' => $id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return back()->withErrors(['error' => 'An error occurred while fetching lead details: ' . $e->getMessage()]);
        }
    }

    public function edit($id)
    {
        $domain = Session::get('domain');
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$domain || !$sessionToken || !$memberId) {
            Log::error('Authentication required for edit lead', ['id' => $id]);
            return redirect('/login')->withErrors(['msg' => 'Authentication required']);
        }

        try {
            // Fetch lead details
            $leadResponse = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . "leads/{$id}");

            if ($leadResponse->failed()) {
                Log::error('Failed to fetch lead details for edit', [
                    'id' => $id,
                    'response' => $leadResponse->json(),
                    'status' => $leadResponse->status(),
                ]);
                return back()->withErrors(['error' => $leadResponse->json()['message'] ?? 'Failed to fetch lead details']);
            }

            // Fetch statuses and sources for dropdowns
            $listResponse = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . 'leads', ['domain' => $domain]);

            if ($listResponse->failed()) {
                Log::error('Failed to fetch statuses and sources for edit lead', [
                    'response' => $listResponse->json(),
                    'status' => $listResponse->status(),
                ]);
            }

            $lead = $leadResponse->json() ?? [];
            $statuses = $listResponse->json()['statuses'] ?? [];
            $sources = $listResponse->json()['sources'] ?? [];

            Log::info('Fetched data for edit lead form', [
                'id' => $id,
                'lead' => $lead,
                'statuses_count' => count($statuses),
                'sources_count' => count($sources),
            ]);

            return view('leads.edit', compact('lead', 'id', 'statuses', 'sources'));
        } catch (\Exception $e) {
            Log::error('Error fetching data for edit lead form', ['id' => $id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return back()->withErrors(['error' => 'An error occurred while loading edit lead form: ' . $e->getMessage()]);
        }
    }

    public function update(Request $request, $id)
    {
        $domain = Session::get('domain');
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$domain || !$sessionToken || !$memberId) {
            Log::error('Authentication required for update lead', ['id' => $id]);
            return redirect('/login')->withErrors(['msg' => 'Authentication required']);
        }

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
            $response = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->patch(env('BASE_API_URL') . "leads/{$id}", array_merge($request->all(), ['domain' => $domain]));

            if ($response->successful()) {
                Log::info('Lead updated successfully', ['id' => $id, 'response' => $response->json()]);
                return redirect()->route('leads.index')->with('success', 'Lead updated successfully');
            }

            Log::error('Failed to update lead', ['id' => $id, 'response' => $response->json(), 'status' => $response->status()]);
            return back()->withErrors(['error' => $response->json()['message'] ?? 'Failed to update lead']);
        } catch (\Exception $e) {
            Log::error('Error updating lead', ['id' => $id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return back()->withErrors(['error' => 'An error occurred while updating lead: ' . $e->getMessage()]);
        }
    }

    public function destroy($id)
    {
        $domain = Session::get('domain');
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$domain || !$sessionToken || !$memberId) {
            Log::error('Authentication required for delete lead', ['id' => $id]);
            return redirect('/login')->withErrors(['msg' => 'Authentication required']);
        }

        try {
            $response = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->delete(env('BASE_API_URL') . "leads/{$id}");

            if ($response->successful()) {
                Log::info('Lead deleted successfully', ['id' => $id, 'response' => $response->json()]);
                return redirect()->route('leads.index')->with('success', 'Lead deleted successfully');
            }

            Log::error('Failed to delete lead', ['id' => $id, 'response' => $response->json(), 'status' => $response->status()]);
            return back()->withErrors(['error' => $response->json()['message'] ?? 'Failed to delete lead']);
        } catch (\Exception $e) {
            Log::error('Error deleting lead', ['id' => $id, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return back()->withErrors(['error' => 'An error occurred while deleting lead: ' . $e->getMessage()]);
        }
    }

    public function webhookLogs(Request $request)
    {
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');
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

            $response = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . "webhook/logs", $params);

            $data = $response->json();
            $logs = $data['logs'] ?? [];
            $total = $data['total'] ?? 0;
            $currentPage = $data['page'] ?? 1;
            $perPage = $data['limit'] ?? 10;
            $totalPages = $data['totalPages'] ?? 1;

            return view('leads.webhook_logs', compact('logs', 'total', 'currentPage', 'perPage', 'totalPages'));
        } catch (\Exception $e) {
            Log::error('Failed to fetch webhook logs', ['error' => $e->getMessage()]);
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
            $response = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . 'webhook/logs', $params);

            if ($response->failed()) {
                Log::error('Failed to check recent webhooks', [
                    'response' => $response->json(),
                    'status' => $response->status(),
                ]);
                return 0;
            }

            $logs = $response->json()['logs'] ?? [];
            $recentCount = count(array_filter($logs, function ($log) use ($leadId) {
                $isRecent = \Carbon\Carbon::parse($log['createdAt'])->gt(now()->subMinutes(5));
                if ($leadId) {
                    return $isRecent && $log['event'] === 'ONCRMLEADUPDATE' && strpos($log['payload'], '"ID":"' . $leadId . '"') !== false;
                }
                return $isRecent && in_array($log['event'], ['ONCRMLEADADD', 'ONCRMLEADUPDATE']);
            }));

            return $recentCount;
        } catch (\Exception $e) {
            Log::error('Error checking recent webhooks', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return 0;
        }
    }
}