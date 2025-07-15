<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Session;

class LeadController extends Controller
{
    public function index(Request $request)
    {
        $domain = Session::get('domain'); // bạn cần lưu nó khi login xong
        if (!$domain)
            return redirect('/login')->withErrors(['msg' => 'Chưa xác định domain']);

        $queryParams = $request->only(['search', 'status', 'sort', 'date']);
        $queryParams['domain'] = $domain;

        $response = Http::withHeaders([
            'X-Session-Token' => Session::get('session_token'),
            'X-Member-Id' => Session::get('member_id')
        ])
            ->withOptions(['verify' => false])
            ->get(env('BASE_API_URL') . '/leads', $queryParams);

        $data = $response->json();

        if (!isset($data['leads'])) {
            return back()->withErrors(['msg' => 'Không lấy được dữ liệu từ API']);
        }

        return view('leads.index', [
            'leads' => $data['leads'],
            'fields' => $data['fields'] ?? []
        ]);
    }


    public function create()
    {
        return view('leads.create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'TITLE' => 'required|string',
            'EMAIL' => 'nullable|email',
            'PHONE' => 'nullable|string',
            'STATUS_ID' => 'nullable|string',
            'SOURCE_ID' => 'nullable|string',
            'COMMENTS' => 'nullable|string',
        ]);

        $validated['domain'] = Session::get('domain');

        $response = Http::withHeaders([
            'X-Session-Token' => Session::get('session_token'),
            'X-Member-Id' => Session::get('member_id')
        ])
            ->withOptions(['verify' => false])
            ->post(env('BASE_API_URL') . '/leads', $validated);

        if ($response->failed()) {
            return back()->withErrors(['msg' => 'Tạo lead thất bại']);
        }

        return redirect('/leads')->with('success', 'Tạo lead thành công');
    }

    public function edit($id)
    {
        // Tuỳ chọn: bạn có thể thêm API /leads/:id để lấy chi tiết lead nếu cần
        return view('leads.edit', compact('id'));
    }

    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'TITLE' => 'required|string',
            'COMMENTS' => 'nullable|string',
        ]);
        $validated['domain'] = Session::get('domain');

        $response = Http::withHeaders([
            'X-Session-Token' => Session::get('session_token'),
            'X-Member-Id' => Session::get('member_id')
        ])
            ->withOptions(['verify' => false])
            ->patch(env('BASE_API_URL') . "/leads/{$id}", $validated);

        return redirect('/leads')->with('success', 'Lead đã được cập nhật');
    }

    public function destroy($id)
    {
        $response = Http::withHeaders([
            'X-Session-Token' => Session::get('session_token'),
            'X-Member-Id' => Session::get('member_id')
        ])
            ->withOptions(['verify' => false])
            ->delete(env('BASE_API_URL') . "/leads/{$id}");

        return redirect('/leads')->with('success', 'Lead đã bị xóa');
    }
}
