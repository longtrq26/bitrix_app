<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Session;

class ThemeController extends Controller
{
    public function update(Request $request)
    {
        $request->validate(['theme' => 'required|in:light,dark']);
        Session::put('theme', $request->input('theme'));
        return response()->json(['success' => true]);
    }
}
