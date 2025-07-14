<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard</title>
    @vite('resources/css/app.css')
</head>

<body class="bg-gray-50 min-h-screen flex items-center justify-center font-sans text-gray-800">
    <div class="bg-white p-10 rounded-lg shadow-lg border border-gray-200 text-center max-w-lg mx-auto">
        <h1 class="text-4xl font-extrabold text-gray-900 mb-4">
            <span role="img" aria-label="party popper">🎉</span> Đăng nhập thành công!
        </h1>
        <p class="text-lg text-gray-700 mb-6">
            Bạn đã kết nối thành công với Bitrix24.
        </p>

        <div class="bg-gray-100 p-4 rounded-md border border-gray-300 inline-block">
            <p class="text-sm text-gray-600 mb-2">Token phiên của bạn:</p>
            <code
                class="block text-gray-900 font-mono break-all text-base bg-white p-2 rounded-md border border-gray-300 shadow-inner">
                {{ session('session_token') }}
            </code>
        </div>

        <p class="mt-8 text-sm text-gray-500">
            Hãy giữ token này an toàn.
        </p>
    </div>
</body>

</html>