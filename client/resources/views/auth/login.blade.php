<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bitrix24 Login</title>
    @vite('resources/css/app.css')
</head>

<body class="bg-gray-50 min-h-screen flex items-center justify-center font-sans text-gray-800">
    <div class="w-full max-w-sm mx-auto">
        <form method="POST" action="{{ route('auth.redirect') }}"
            class="bg-white p-8 rounded-xl shadow-md border border-gray-200">
            @csrf
            <h2 class="text-3xl font-extrabold text-center text-gray-900 mb-8">Đăng nhập với Bitrix24</h2>

            <div class="mb-6">
                <label for="domain" class="block text-sm font-medium text-gray-700 mb-2">Tên miền Bitrix24 của
                    bạn:</label>
                <input type="text" id="domain" name="domain" placeholder="yourcompany.bitrix24.vn" required
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition duration-200 ease-in-out placeholder-gray-400 text-gray-800" />
            </div>

            @if ($errors->any())
                <div class="mt-4 p-3 mb-6 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center"
                    role="alert">
                    <svg class="h-5 w-5 mr-3 text-red-500 flex-shrink-0" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div class="text-sm">
                        {{ $errors->first('msg') }}
                    </div>
                </div>
            @endif

            <button type="submit"
                class="w-full bg-gray-900 text-white py-3 px-4 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:ring-offset-white transition duration-200 ease-in-out text-lg font-semibold shadow-sm">
                Kết nối với Bitrix24
            </button>
        </form>
    </div>
</body>

</html>