<!DOCTYPE html>
<html lang="vi">

<head>
    <meta charset="UTF-8">
    <title>Đăng nhập Bitrix24</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>

<body class="bg-gray-100 flex items-center justify-center h-screen">
    <div class="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h1 class="text-2xl font-bold mb-6 text-center">Đăng nhập Bitrix24</h1>

        @if ($errors->any())
            <div class="mb-4 text-red-500 text-sm">{{ $errors->first() }}</div>
        @endif

        <form method="GET" action="/connect">
            <div class="mb-4">
                <label class="block font-semibold mb-2">Tên miền Bitrix24</label>
                <input type="text" name="domain" placeholder="yourcompany.bitrix24.vn" class="w-full border rounded p-2"
                    required pattern="^[a-zA-Z0-9.-]+\.bitrix24\.(vn|com)$">
            </div>

            <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded font-semibold">
                Đăng nhập với Bitrix24
            </button>
        </form>
    </div>
</body>

</html>