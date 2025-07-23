<!DOCTYPE html>
<html lang="vi">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Đăng nhập Bitrix24</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>

<body class="bg-gray-100 dark:bg-gray-900 flex items-center justify-center min-h-screen">
    <div class="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 class="text-2xl font-bold mb-6 text-center dark:text-white">Đăng nhập Bitrix24</h1>

        @if ($errors->any())
            <div class="mb-4 text-red-500 text-sm text-center">{{ $errors->first() }}</div>
        @endif

        <form method="GET" action="/connect">
            <div class="mb-4">
                <label class="block text-sm font-medium dark:text-gray-300 mb-2">Tên miền Bitrix24</label>
                <input type="text" name="domain" placeholder="yourcompany.bitrix24.vn" required
                    pattern="^[a-zA-Z0-9.-]+\.bitrix24\.(vn|com)$"
                    class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
            </div>
            <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded font-semibold">
                Đăng nhập với Bitrix24
            </button>
        </form>
    </div>
</body>

</html>