<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Session;

class LeadController extends Controller
{
    public function index(Request $request)
    {
        $domain = Session::get('domain');
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$domain || !$sessionToken || !$memberId) {
            return redirect('/login')->withErrors(['msg' => 'Phiên đăng nhập không hợp lệ']);
        }

        $queryParams = $request->only(['find', 'status', 'source', 'date', 'sort']);
        $queryParams['domain'] = $domain;

        try {
            $response = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . '/leads', $queryParams);

            if ($response->status() === 401) {
                Session::flush();
                return redirect('/login')->withErrors(['msg' => 'Phiên đăng nhập hết hạn']);
            } elseif ($response->status() === 429) {
                return back()->withErrors(['msg' => 'Quá nhiều yêu cầu, vui lòng thử lại sau']);
            }

            $data = $response->json();
            if (!isset($data['leads'])) {
                return back()->withErrors(['msg' => 'Không lấy được dữ liệu từ API']);
            }

            return view('leads.index', [
                'leads' => $data['leads'] ?? [],
                'fields' => $data['fields'] ?? [],
                'statuses' => $data['statuses'] ?? [],
                'sources' => $data['sources'] ?? [],
                'queryParams' => $queryParams,
            ]);
        } catch (\Exception $e) {
            return back()->withErrors(['msg' => 'Lỗi hệ thống: ' . $e->getMessage()]);
        }
    }

    public function create()
    {
        $domain = Session::get('domain');
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$domain || !$sessionToken || !$memberId) {
            return redirect('/login')->withErrors(['msg' => 'Phiên đăng nhập không hợp lệ']);
        }

        try {
            $response = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . '/leads', ['domain' => $domain]);

            if ($response->failed()) {
                return redirect('/login')->withErrors(['msg' => 'Không thể lấy danh sách trạng thái/nguồn']);
            }

            $data = $response->json();
            return view('leads.create', [
                'statuses' => $data['statuses'] ?? [],
                'sources' => $data['sources'] ?? [],
            ]);
        } catch (\Exception $e) {
            return back()->withErrors(['msg' => 'Lỗi hệ thống: ' . $e->getMessage()]);
        }
    }

    public function store(Request $request)
    {
        $domain = Session::get('domain');
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$domain || !$sessionToken || !$memberId) {
            return redirect('/login')->withErrors(['msg' => 'Phiên đăng nhập không hợp lệ']);
        }

        $validated = $request->validate([
            'TITLE' => 'required|string|max:100',
            'EMAIL' => 'nullable|email',
            'PHONE' => 'nullable|string',
            'STATUS_ID' => 'nullable|string',
            'SOURCE_ID' => 'nullable|string',
            'COMMENTS' => 'nullable|string|max:1000',
        ]);

        $validated['domain'] = $domain;

        try {
            $response = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->post(env('BASE_API_URL') . '/leads', $validated);

            if ($response->failed()) {
                if ($response->status() === 401) {
                    Session::flush();
                    return redirect('/login')->withErrors(['msg' => 'Phiên đăng nhập hết hạn']);
                } elseif ($response->status() === 429) {
                    return back()->withErrors(['msg' => 'Quá nhiều yêu cầu, vui lòng thử lại sau']);
                }
                return back()->withErrors(['msg' => 'Tạo lead thất bại: ' . ($response->json()['error_description'] ?? 'Lỗi không xác định')]);
            }

            return redirect('/leads')->with('success', 'Tạo lead thành công');
        } catch (\Exception $e) {
            return back()->withErrors(['msg' => 'Lỗi hệ thống: ' . $e->getMessage()]);
        }
    }

    public function edit($id)
    {
        $domain = Session::get('domain');
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$domain || !$sessionToken || !$memberId) {
            return redirect('/login')->withErrors(['msg' => 'Phiên đăng nhập không hợp lệ']);
        }

        try {
            $response = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . '/leads', ['domain' => $domain]);

            if ($response->failed()) {
                return redirect('/login')->withErrors(['msg' => 'Không thể lấy dữ liệu']);
            }

            $data = $response->json();
            $lead = collect($data['leads'])->firstWhere('ID', $id);

            if (!$lead) {
                return back()->withErrors(['msg' => 'Lead không tồn tại']);
            }

            return view('leads.edit', [
                'id' => $id,
                'lead' => $lead,
                'statuses' => $data['statuses'] ?? [],
                'sources' => $data['sources'] ?? [],
            ]);
        } catch (\Exception $e) {
            return back()->withErrors(['msg' => 'Lỗi hệ thống: ' . $e->getMessage()]);
        }
    }

    public function update(Request $request, $id)
    {
        $domain = Session::get('domain');
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$domain || !$sessionToken || !$memberId) {
            return redirect('/login')->withErrors(['msg' => 'Phiên đăng nhập không hợp lệ']);
        }

        $validated = $request->validate([
            'TITLE' => 'required|string|max:100',
            'EMAIL' => 'nullable|email',
            'PHONE' => 'nullable|string',
            'STATUS_ID' => 'nullable|string',
            'SOURCE_ID' => 'nullable|string',
            'COMMENTS' => 'nullable|string|max:1000',
        ]);
        $validated['domain'] = $domain;

        try {
            $response = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->patch(env('BASE_API_URL') . "/leads/{$id}", $validated);

            if ($response->failed()) {
                if ($response->status() === 401) {
                    Session::flush();
                    return redirect('/login')->withErrors(['msg' => 'Phiên đăng nhập hết hạn']);
                } elseif ($response->status() === 429) {
                    return back()->withErrors(['msg' => 'Quá nhiều yêu cầu, vui lòng thử lại sau']);
                }
                return back()->withErrors(['msg' => 'Cập nhật lead thất bại: ' . ($response->json()['error_description'] ?? 'Lỗi không xác định')]);
            }

            return redirect('/leads')->with('success', 'Lead đã được cập nhật');
        } catch (\Exception $e) {
            return back()->withErrors(['msg' => 'Lỗi hệ thống: ' . $e->getMessage()]);
        }
    }

    public function destroy($id)
    {
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$sessionToken || !$memberId) {
            return redirect('/login')->withErrors(['msg' => 'Phiên đăng nhập không hợp lệ']);
        }

        try {
            $response = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->delete(env('BASE_API_URL') . "/leads/{$id}");

            if ($response->failed()) {
                if ($response->status() === 401) {
                    Session::flush();
                    return redirect('/login')->withErrors(['msg' => 'Phiên đăng nhập hết hạn']);
                } elseif ($response->status() === 429) {
                    return back()->withErrors(['msg' => 'Quá nhiều yêu cầu, vui lòng thử lại sau']);
                }
                return back()->withErrors(['msg' => 'Xóa lead thất bại: ' . ($response->json()['error_description'] ?? 'Lỗi không xác định')]);
            }

            return redirect('/leads')->with('success', 'Lead đã bị xóa');
        } catch (\Exception $e) {
            return back()->withErrors(['msg' => 'Lỗi hệ thống: ' . $e->getMessage()]);
        }
    }

    public function json(Request $request)
    {
        $domain = Session::get('domain');
        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$domain || !$sessionToken || !$memberId) {
            return response()->json(['error' => 'Phiên đăng nhập không hợp lệ'], 401);
        }

        $queryParams = $request->only(['find', 'status', 'source', 'date', 'sort']);
        $queryParams['domain'] = $domain;

        try {
            $response = Http::withHeaders([
                'X-Session-Token' => $sessionToken,
                'X-Member-Id' => $memberId,
            ])
                ->withOptions(['verify' => false])
                ->get(env('BASE_API_URL') . '/leads', $queryParams);

            if ($response->failed()) {
                return response()->json(['error' => $response->json()['error_description'] ?? 'API error'], $response->status());
            }

            return $response->json();
        } catch (\Exception $e) {
            return response()->json(['error' => 'Lỗi hệ thống: ' . $e->getMessage()], 500);
        }
    }

    public function setTheme(Request $request)
    {
        $theme = $request->input('theme', 'light');
        session(['theme' => $theme]);
        return response()->json(['success' => true]);
    }
}