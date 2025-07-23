<!DOCTYPE html>
<html lang="vi">

<head>
    <meta charset="UTF-8">
    <title>Bitrix24 CRM Automation Suite</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</head>

<body class="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white min-h-screen p-6">
    <div class="max-w-7xl mx-auto space-y-6">
        <h1 class="text-3xl font-bold">Danh sách Lead</h1>

        @if (session('success'))
            <script>
                Swal.fire({ icon: 'success', title: 'Thành công', text: '{{ session('success') }}' });
            </script>
        @endif
        @if ($errors->has('error'))
            <script>
                Swal.fire({ icon: 'error', title: 'Lỗi', text: '{{ $errors->first('error') }}' });
            </script>
        @endif

        @if ($recentWebhooks > 0)
            <script>
                Swal.fire({
                    icon: 'info',
                    title: 'Cập nhật mới',
                    text: '{{ $recentWebhooks }} sự kiện webhook mới đã được ghi nhận. Vui lòng làm mới trang để xem dữ liệu mới nhất.',
                    showConfirmButton: true,
                    confirmButtonText: 'Làm mới',
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.location.reload();
                    }
                });
            </script>
        @endif

        <div class="flex justify-end mb-4">
            <a href="{{ route('leads.webhook_logs') }}"
                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Xem Webhook Logs</a>
        </div>

        <form method="GET" action="{{ route('leads.index') }}"
            class="grid grid-cols-1 md:grid-cols-5 gap-4 bg-white dark:bg-gray-800 p-4 rounded shadow">
            <input type="text" name="find" placeholder="Tìm theo tiêu đề" value="{{ request('find') }}"
                class="border p-2 rounded dark:bg-gray-700 dark:text-white">
            <select name="status" class="border p-2 rounded dark:bg-gray-700 dark:text-white">
                <option value="">Tất cả trạng thái</option>
                @foreach ($statuses ?? [] as $status)
                    <option value="{{ $status['STATUS_ID'] }}" {{ request('status') === $status['STATUS_ID'] ? 'selected' : '' }}>
                        {{ $status['NAME'] }}
                    </option>
                @endforeach
            </select>
            <select name="source" class="border p-2 rounded dark:bg-gray-700 dark:text-white">
                <option value="">Tất cả nguồn</option>
                @foreach ($sources ?? [] as $source)
                    <option value="{{ $source['STATUS_ID'] }}" {{ request('source') === $source['STATUS_ID'] ? 'selected' : '' }}>
                        {{ $source['NAME'] }}
                    </option>
                @endforeach
            </select>
            <input type="date" name="date" value="{{ request('date') }}"
                class="border p-2 rounded dark:bg-gray-700 dark:text-white">
            <select name="sort" class="border p-2 rounded dark:bg-gray-700 dark:text-white">
                <option value="DATE_CREATE" {{ request('sort') === 'DATE_CREATE' ? 'selected' : '' }}>Sắp xếp theo ngày
                </option>
                <option value="TITLE" {{ request('sort') === 'TITLE' ? 'selected' : '' }}>Sắp xếp theo tiêu đề</option>
            </select>
            <div class="md:col-span-5 text-right">
                <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Lọc</button>
            </div>
        </form>

        <form method="POST" action="{{ route('leads.store') }}"
            class="bg-white dark:bg-gray-800 p-6 rounded shadow space-y-4">
            @csrf
            <h2 class="text-xl font-semibold">Thêm Lead mới</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <input type="text" name="TITLE" placeholder="Tiêu đề *" value="{{ old('TITLE') }}"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white" required>
                    @error('TITLE') <p class="text-red-500 text-sm">{{ $message }}</p> @enderror
                </div>
                <input type="text" name="NAME" placeholder="Tên" value="{{ old('NAME') }}"
                    class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white">
                <input type="email" name="EMAIL" placeholder="Email" value="{{ old('EMAIL') }}"
                    class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white">
                @error('EMAIL') <p class="text-red-500 text-sm">{{ $message }}</p> @enderror
                <input type="text" name="PHONE" placeholder="SĐT" value="{{ old('PHONE') }}"
                    class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white">
                <div>
                    <select name="STATUS_ID" class="border p-2 rounded dark:bg-gray-700 dark:text-white w-full">
                        <option value="">Chọn trạng thái</option>
                        @foreach ($statuses ?? [] as $status)
                            <option value="{{ $status['STATUS_ID'] }}" {{ old('STATUS_ID') == $status['STATUS_ID'] ? 'selected' : '' }}>
                                {{ $status['NAME'] }}
                            </option>
                        @endforeach
                    </select>
                </div>
                <div>
                    <select name="SOURCE_ID" class="border p-2 rounded dark:bg-gray-700 dark:text-white w-full">
                        <option value="">Chọn nguồn</option>
                        @foreach ($sources ?? [] as $source)
                            <option value="{{ $source['STATUS_ID'] }}" {{ old('SOURCE_ID') == $source['STATUS_ID'] ? 'selected' : '' }}>
                                {{ $source['NAME'] }}
                            </option>
                        @endforeach
                    </select>
                </div>
                <textarea name="COMMENTS" rows="3" placeholder="Ghi chú"
                    class="md:col-span-2 w-full border p-2 rounded dark:bg-gray-700 dark:text-white">{{ old('COMMENTS') }}</textarea>
                @error('COMMENTS') <p class="text-red-500 text-sm">{{ $message }}</p> @enderror
            </div>
            <button type="submit" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Thêm
                Lead</button>
        </form>

        <div class="overflow-x-auto bg-white dark:bg-gray-800 rounded shadow">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-100 dark:bg-gray-700">
                    <tr>
                        <th class="px-4 py-2 text-left">ID</th>
                        <th class="px-4 py-2 text-left">Tiêu đề</th>
                        <th class="px-4 py-2 text-left">Trạng thái</th>
                        <th class="px-4 py-2 text-left">Nguồn</th>
                        <th class="px-4 py-2 text-left">Ngày tạo</th>
                        <th class="px-4 py-2 text-left">Hành động</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                    @if (empty($leads))
                        <tr>
                            <td colspan="6" class="px-4 py-4 text-center">Không có lead nào</td>
                        </tr>
                    @else
                        @foreach ($leads as $lead)
                            <tr>
                                <td class="px-4 py-2">{{ $lead['ID'] ?? 'N/A' }}</td>
                                <td class="px-4 py-2">{{ $lead['TITLE'] ?? 'N/A' }}</td>
                                <td class="px-4 py-2">
                                    {{ collect($statuses)->firstWhere('STATUS_ID', $lead['STATUS_ID'])['NAME'] ?? $lead['STATUS_ID'] ?? 'N/A' }}
                                </td>
                                <td class="px-4 py-2">
                                    {{ collect($sources)->firstWhere('STATUS_ID', $lead['SOURCE_ID'])['NAME'] ?? $lead['SOURCE_ID'] ?? 'N/A' }}
                                </td>
                                <td class="px-4 py-2">
                                    {{ isset($lead['DATE_CREATE']) ? \Carbon\Carbon::parse($lead['DATE_CREATE'])->format('d/m/Y H:i') : 'N/A' }}
                                </td>
                                <td class="px-4 py-2 space-x-2">
                                    <a href="{{ route('leads.show', $lead['ID']) }}"
                                        class="text-blue-600 hover:underline">Xem</a>
                                    <form action="{{ route('leads.destroy', $lead['ID']) }}" method="POST" class="inline">
                                        @csrf
                                        @method('DELETE')
                                        <button type="submit" class="text-red-600 hover:underline"
                                            onclick="return confirm('Bạn có chắc chắn muốn xóa?')">Xóa</button>
                                    </form>
                                </td>
                            </tr>
                        @endforeach
                    @endif
                </tbody>
            </table>
        </div>
    </div>
</body>

</html>