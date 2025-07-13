<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Session;

class LeadController extends Controller
{

    public function index(Request $request)
    {
        $memberId = Session::get('member_id');
        $domain = Session::get('domain');

        $response = Http::withHeaders([
            'x-member-id' => $memberId
        ])->get("http://localhost:3001/api/leads", [
                    'domain' => $domain
                ]);

        if ($response->failed()) {
            return back()->withErrors(['msg' => 'Không lấy được danh sách lead']);
        }

        $leads = $response->json();

        return view('leads.index', compact('leads'));
    }

    public function create()
    {
        return view('leads.create');
    }

    public function store(Request $request)
    {
        $memberId = Session::get('member_id');

        $response = Http::withHeaders([
            'x-member-id' => $memberId
        ])->post("http://localhost:3001/api/leads", [
                    'TITLE' => $request->input('title'),
                    'STATUS_ID' => $request->input('status_id'),
                    'SOURCE_ID' => $request->input('source_id'),
                    'domain' => Session::get('domain'),
                ]);

        if ($response->failed()) {
            return back()->withErrors(['msg' => 'Tạo Lead thất bại']);
        }

        return redirect()->route('leads.index');
    }

    public function destroy($id)
    {
        $memberId = Session::get('member_id');

        $response = Http::withHeaders([
            'x-member-id' => $memberId
        ])->delete("http://localhost:3001/api/leads/{$id}");

        if ($response->failed()) {
            return back()->withErrors(['msg' => 'Xóa Lead thất bại']);
        }

        return redirect()->route('leads.index');
    }
}
