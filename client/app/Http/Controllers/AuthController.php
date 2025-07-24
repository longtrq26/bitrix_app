<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    public function showLoginForm()
    {
        return view('auth.login');
    }

    public function redirectToBitrix(Request $request)
    {
        Log::info('Received request to redirect to Bitrix24.', ['input_domain' => $request->input('domain')]);

        $request->validate([
            'domain' => ['required', 'regex:/^[a-zA-Z0-9.-]+\.bitrix24\.(vn|com)$/']
        ]);

        $domain = $request->input('domain');

        try {
            $response = Http::withOptions(['verify' => false, 'allow_redirects' => false])
                ->get(env('BASE_API_URL') . 'auth/redirect', [
                    'domain' => $domain,
                ]);

            if ($response->status() === 302 && $response->header('Location')) {
                Log::info('Successfully obtained Bitrix24 redirect URL.', ['domain' => $domain, 'redirect_url' => $response->header('Location')]);
                return redirect()->away($response->header('Location'));
            } elseif ($response->serverError()) {
                $errorMessage = 'Hệ thống xác thực đang gặp sự cố. Vui lòng thử lại sau.';
                Log::error('Backend server error during Bitrix24 redirect URL generation.', [
                    'domain' => $domain,
                    'status' => $response->status(),
                    'response_body' => $response->json(),
                ]);

                return redirect('/login')->withErrors(['msg' => $errorMessage]);
            } else {
                $errorMessage = 'Không thể redirect tới Bitrix24. Vui lòng kiểm tra lại domain hoặc liên hệ hỗ trợ.';
                Log::warning('Unexpected response from backend during Bitrix24 redirect URL generation.', [
                    'domain' => $domain,
                    'status' => $response->status(),
                    'response_body' => $response->json(),
                ]);

                return redirect('/login')->withErrors(['msg' => $errorMessage]);
            }
        } catch (\Exception $e) {
            Log::error('Exception occurred during Bitrix24 redirect URL generation.', [
                'domain' => $domain,
                'error_message' => $e->getMessage(),
                'error_trace' => $e->getTraceAsString(),
            ]);

            return redirect('/login')->withErrors(['msg' => 'Đã xảy ra lỗi không mong muốn trong quá trình xác thực.']);
        }
    }

    public function handleCallback(Request $request)
    {
        Log::info('Received OAuth callback from Backend.', ['query_params' => $request->query()]);

        $sessionToken = $request->input('session');
        if (!$sessionToken) {
            Log::warning('Missing session token in callback query parameter. This indicates a potential flow issue or error from backend redirect.', [
                'request_url' => $request->fullUrl()
            ]);
            return redirect('/login')->withErrors(['msg' => 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.']);
        }

        try {
            Log::info('Attempting to fetch member data using session token.', ['session_token_partial' => substr($sessionToken, 0, 8) . '...']);

            $response = Http::backend()
                ->get(env('BASE_API_URL') . 'auth/member', [
                    'session' => $sessionToken,
                ]);

            if ($response->failed()) {
                Log::error('Failed to fetch member data from backend API.', [
                    'session_token_partial' => substr($sessionToken, 0, 8) . '...',
                    'status' => $response->status(),
                    'response_body' => $response->json(),
                ]);

                if ($response->status() === 401) {
                    return redirect('/login')->withErrors(['msg' => 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.']);
                }

                return redirect('/login')->withErrors(['msg' => 'Không thể lấy thông tin người dùng.']);
            }

            $memberId = $response->json('memberId');
            if (!$memberId) {
                Log::error('Missing memberId in auth/member response from backend.', [
                    'session_token_partial' => substr($sessionToken, 0, 8) . '...',
                    'response_body' => $response->json(),
                ]);

                return redirect('/login')->withErrors(['msg' => 'Không thể lấy member ID.']);
            }

            Session::put('session_token', $sessionToken);
            Session::put('member_id', $memberId);
            Log::info('Successfully processed OAuth callback and saved member ID to Laravel session.', [
                'member_id' => $memberId,
                'session_token_partial' => substr($sessionToken, 0, 8) . '...'
            ]);

            return redirect('/leads');
        } catch (\Exception $e) {
            Log::error('Exception occurred during OAuth callback handling.', [
                'session_token_partial' => substr($sessionToken, 0, 8) . '...',
                'error_message' => $e->getMessage(),
                'error_trace' => $e->getTraceAsString(), // Chỉ nên có trong môi trường dev/staging
            ]);

            return redirect('/login')->withErrors(['msg' => 'Đã xảy ra lỗi không mong muốn khi xử lý đăng nhập.']);
        }
    }

    public function logout(Request $request)
    {
        Log::info('Received logout request.');

        $sessionToken = Session::get('session_token');
        $memberId = Session::get('member_id');

        if (!$sessionToken || !$memberId) {
            Log::warning('Logout request received but no session token or member ID found in Laravel session.');
            Session::flush(); // Xóa toàn bộ session Laravel
            return redirect('/login')->withErrors(['msg' => 'Bạn đã đăng xuất hoặc phiên đã hết hạn.']);
        }

        try {
            $response = Http::backend()
                ->post(env('BASE_API_URL') . 'auth/logout', [
                    'memberId' => $memberId,
                ]);

            if ($response->failed()) {
                Log::error('Failed to logout from backend API.', [
                    'member_id' => $memberId,
                    'status' => $response->status(),
                    'response_body' => $response->json(),
                ]);
            } else {
                Log::info('Successfully processed logout request with backend.', ['member_id' => $memberId]);
            }

            Session::flush();
            Log::info('Laravel session flushed after logout.', ['member_id' => $memberId]);

            return redirect('/login')->with('success', 'Bạn đã đăng xuất thành công.');

        } catch (\Exception $e) {
            Log::error('Exception occurred during logout process.', [
                'member_id' => $memberId,
                'error_message' => $e->getMessage(),
                'error_trace' => $e->getTraceAsString(),
            ]);
            Session::flush();
            return redirect('/login')->withErrors(['msg' => 'Đã xảy ra lỗi khi đăng xuất.']);
        }
    }
}
