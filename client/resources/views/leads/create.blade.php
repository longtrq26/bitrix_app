<!DOCTYPE html>
<html>

<head>
    <title>Thêm Lead - Bitrix24 CRM Automation Suite</title>
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/toastr@2.1.4/build/toastr.min.css" rel="stylesheet">
</head>

<body class="{{ session('theme', 'light') }} container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4 dark:text-white">Thêm Lead Mới</h1>

    @if($errors->any())
        <script> toastr.error("{{ $errors->first() }}", "Lỗi"); </script>
    @endif

    <form method="POST" action="{{ url('/leads') }}" class="space-y-4">
        @csrf
        <div>
            <label class="block dark:text-white">Tiêu đề</label>
            <input type="text" name="TITLE" class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white" required>
        </div>
        <div>
            <label class="block dark:text-white">Email</label>
            <input type="email" name="EMAIL" class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white">
        </div>
        <div>
            <label class="block dark:text-white">Số điện thoại</label>
            <input type="text" name="PHONE" class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white">
        </div>
        <div>
            <label class="block dark:text-white">Trạng thái</label>
            <select name="STATUS_ID" class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white">
                <option value="">Chọn trạng thái</option>
                @foreach($statuses as $status)
                    <option value="{{ $status['STATUS_ID'] }}">{{ $status['NAME'] }}</option>
                @endforeach
            </select>
        </div>
        <div>
            <label class="block dark:text-white">Nguồn</label>
            <select name="SOURCE_ID" class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white">
                <option value="">Chọn nguồn</option>
                @foreach($sources as $source)
                    <option value="{{ $source['STATUS_ID'] }}">{{ $source['NAME'] }}</option>
                @endforeach
            </select>
        </div>
        <div>
            <label class="block dark:text-white">Ghi chú</label>
            <textarea name="COMMENTS" class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white"></textarea>
        </div>
        <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded dark:bg-blue-500">
            Tạo Lead
        </button>
    </form>

    <script src="https://cdn.jsdelivr.net/npm/toastr@2.1.4/build/toastr.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</body>

</html>