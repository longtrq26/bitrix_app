<!DOCTYPE html>
<html>

<head>
    <title>Chi tiết Lead</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</head>

<body class="container mx-auto p-4 dark:bg-gray-800">
    <h1 class="text-2xl font-bold mb-4 dark:text-white">Chi tiết Lead #{{ $id }}</h1>

    {{-- Thông báo --}}
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
                text: '{{ $recentWebhooks }} sự kiện webhook mới đã được ghi nhận cho lead này. Vui lòng làm mới trang để xem dữ liệu mới nhất.',
                confirmButtonText: 'Làm mới',
            }).then((result) => {
                if (result.isConfirmed) window.location.reload();
            });
        </script>
    @endif

    @php
        $title = $lead['TITLE'] ?? '';
        $name = $lead['NAME'] ?? '';
        $email = $lead['EMAIL'][0]['VALUE'] ?? '';
        $phone = $lead['PHONE'][0]['VALUE'] ?? '';
        $statusId = $lead['STATUS_ID'] ?? '';
        $sourceId = $lead['SOURCE_ID'] ?? '';
        $comments = $lead['COMMENTS'] ?? '';
    @endphp

    {{-- Form cập nhật Lead --}}
    <form method="POST" action="{{ route('leads.update', $id) }}"
        class="mb-8 bg-white dark:bg-gray-800 p-6 rounded shadow">
        @csrf
        @method('PATCH')
        <h2 class="text-xl font-semibold mb-4 dark:text-white">Cập nhật Lead</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

            <input type="text" name="TITLE" placeholder="Tiêu đề *" value="{{ old('TITLE', $title) }}"
                class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white" required>
            @error('TITLE') <p class="text-red-500 text-sm">{{ $message }}</p> @enderror

            <input type="text" name="NAME" placeholder="Tên" value="{{ old('NAME', $name) }}"
                class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white">

            <input type="email" name="EMAIL" placeholder="Email" value="{{ old('EMAIL', $email) }}"
                class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white">
            @error('EMAIL') <p class="text-red-500 text-sm">{{ $message }}</p> @enderror

            <input type="text" name="PHONE" placeholder="Số điện thoại" value="{{ old('PHONE', $phone) }}"
                class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white">

            <div>
                <select name="STATUS_ID" class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white">
                    <option value="">Chọn trạng thái</option>
                    @foreach ($statuses ?? [] as $status)
                        <option value="{{ $status['STATUS_ID'] }}" {{ old('STATUS_ID', $statusId) == $status['STATUS_ID'] ? 'selected' : '' }}>
                            {{ $status['NAME'] }}
                        </option>
                    @endforeach
                </select>
            </div>

            <div>
                <select name="SOURCE_ID" class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white">
                    <option value="">Chọn nguồn</option>
                    @foreach ($sources ?? [] as $source)
                        <option value="{{ $source['STATUS_ID'] }}" {{ old('SOURCE_ID', $sourceId) == $source['STATUS_ID'] ? 'selected' : '' }}>
                            {{ $source['NAME'] }}
                        </option>
                    @endforeach
                </select>
            </div>

            <textarea name="COMMENTS" rows="3" placeholder="Ghi chú"
                class="md:col-span-2 w-full border p-2 rounded dark:bg-gray-700 dark:text-white">{{ old('COMMENTS', $comments) }}</textarea>
            @error('COMMENTS') <p class="text-red-500 text-sm">{{ $message }}</p> @enderror
        </div>

        <button type="submit" class="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded mt-4">Cập nhật Lead</button>
        <a href="{{ route('leads.index') }}" class="bg-gray-500 hover:bg-gray-600 text-white p-2 rounded mt-4 ml-2">Quay
            lại</a>
    </form>

    {{-- Tasks --}}
    <h2 class="text-xl font-bold mb-2 dark:text-white">Danh sách Task</h2>
    <div class="overflow-x-auto bg-white dark:bg-gray-800 rounded shadow mb-8">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-100 dark:bg-gray-700">
                <tr>
                    <th class="p-2 dark:text-white">ID</th>
                    <th class="p-2 dark:text-white">Tiêu đề</th>
                    <th class="p-2 dark:text-white">Trạng thái</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($tasks as $task)
                    <tr class="dark:bg-gray-800">
                        <td class="p-2 dark:text-white">{{ $task['ID'] ?? $task['id'] ?? 'N/A' }}</td>
                        <td class="p-2 dark:text-white">{{ $task['TITLE'] ?? $task['title'] ?? 'N/A' }}</td>
                        <td class="p-2 dark:text-white">{{ $task['STATUS'] ?? $task['status'] ?? 'N/A' }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="3" class="p-2 text-center dark:text-white">Không có task nào</td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>

    {{-- Deals --}}
    <h2 class="text-xl font-bold mb-2 dark:text-white">Danh sách Deal</h2>
    <div class="overflow-x-auto bg-white dark:bg-gray-800 rounded shadow">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-100 dark:bg-gray-700">
                <tr>
                    <th class="p-2 dark:text-white">ID</th>
                    <th class="p-2 dark:text-white">Tiêu đề</th>
                    <th class="p-2 dark:text-white">Doanh thu</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($deals as $deal)
                    <tr class="dark:bg-gray-800">
                        <td class="p-2 dark:text-white">{{ $deal['ID'] ?? $deal['id'] ?? 'N/A' }}</td>
                        <td class="p-2 dark:text-white">{{ $deal['TITLE'] ?? $deal['title'] ?? 'N/A' }}</td>
                        <td class="p-2 dark:text-white">{{ $deal['OPPORTUNITY'] ?? $deal['opportunity'] ?? 'N/A' }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="3" class="p-2 text-center dark:text-white">Không có deal nào</td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>

    <button onclick="window.location.reload()"
        class="bg-gray-500 hover:bg-gray-600 text-white p-2 rounded mt-4">Reload</button>
</body>

</html>