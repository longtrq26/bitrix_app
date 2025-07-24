@extends('layouts.app')

@section('content')
    <div class="space-y-6">
        <!-- Form tìm kiếm và lọc -->
        <form method="GET" action="{{ route('leads.index') }}" class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Tìm kiếm</label>
                    <input type="text" name="find" value="{{ request('find') }}" placeholder="Tiêu đề, tên, email..."
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Trạng thái</label>
                    <select name="status"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                        <option value="">Tất cả trạng thái</option>
                        @foreach ($statuses ?? [] as $status)
                            <option value="{{ $status['STATUS_ID'] }}" {{ request('status') === $status['STATUS_ID'] ? 'selected' : '' }}>
                                {{ $status['NAME'] }}
                            </option>
                        @endforeach
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Nguồn</label>
                    <select name="source"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                        <option value="">Tất cả nguồn</option>
                        @foreach ($sources ?? [] as $source)
                            <option value="{{ $source['STATUS_ID'] }}" {{ request('source') === $source['STATUS_ID'] ? 'selected' : '' }}>
                                {{ $source['NAME'] }}
                            </option>
                        @endforeach
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Ngày tạo</label>
                    <input type="date" name="date" value="{{ request('date') }}"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Sắp xếp</label>
                    <select name="sort"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                        <option value="DATE_CREATE" {{ request('sort') === 'DATE_CREATE' ? 'selected' : '' }}>Theo ngày
                        </option>
                        <option value="TITLE" {{ request('sort') === 'TITLE' ? 'selected' : '' }}>Theo tiêu đề</option>
                    </select>
                </div>
            </div>
            <div class="mt-4 flex justify-end">
                <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center">
                    <span id="loading"
                        class="hidden animate-spin h-5 w-5 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                    Lọc
                </button>
            </div>
        </form>

        <!-- Nút chuyển đến trang tạo lead -->
        <div class="flex justify-end">
            <a href="{{ route('leads.create') }}"
                class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Thêm Lead</a>
        </div>

        <!-- Bảng lead -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-100 dark:bg-gray-700">
                    <tr>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">ID</th>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Tiêu đề</th>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Trạng thái</th>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Nguồn</th>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Ngày tạo</th>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Hành động</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                    @if (empty($leads))
                        <tr>
                            <td colspan="6" class="px-6 py-4 text-center dark:text-white">Không có lead nào</td>
                        </tr>
                    @else
                        @foreach ($leads as $lead)
                            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td class="px-6 py-4 dark:text-white">{{ $lead['ID'] ?? 'N/A' }}</td>
                                <td class="px-6 py-4 dark:text-white">{{ $lead['TITLE'] ?? 'N/A' }}</td>
                                <td class="px-6 py-4 dark:text-white">
                                    {{ collect($statuses)->firstWhere('STATUS_ID', $lead['STATUS_ID'])['NAME'] ?? $lead['STATUS_ID'] ?? 'N/A' }}
                                </td>
                                <td class="px-6 py-4 dark:text-white">
                                    {{ collect($sources)->firstWhere('STATUS_ID', $lead['SOURCE_ID'])['NAME'] ?? $lead['SOURCE_ID'] ?? 'N/A' }}
                                </td>
                                <td class="px-6 py-4 dark:text-white">
                                    {{ isset($lead['DATE_CREATE']) ? \Carbon\Carbon::parse($lead['DATE_CREATE'])->format('d/m/Y H:i') : 'N/A' }}
                                </td>
                                <td class="px-6 py-4 space-x-2">
                                    <a href="{{ route('leads.show', $lead['ID']) }}"
                                        class="text-blue-600 dark:text-blue-400 hover:underline">Xem</a>
                                    <form action="{{ route('leads.destroy', $lead['ID']) }}" method="POST" class="inline">
                                        @csrf
                                        @method('DELETE')
                                        <button type="submit" class="text-red-600 dark:text-red-400 hover:underline"
                                            onclick="return confirm('Bạn có chắc chắn muốn xóa?')">Xóa</button>
                                    </form>
                                </td>
                            </tr>
                        @endforeach
                    @endif
                </tbody>
            </table>
        </div>

        <!-- Phân trang -->
        @if (!empty($leads))
            <div class="mt-4 flex justify-center">
                <nav class="inline-flex -space-x-px rounded-md shadow">
                    @for ($i = 1; $i <= ceil(count($leads) / 10); $i++)
                        <a href="{{ route('leads.index', array_merge(request()->query(), ['page' => $i])) }}"
                            class="px-3 py-2 {{ request('page', 1) == $i ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 dark:text-white' }} border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                            {{ $i }}
                        </a>
                    @endfor
                </nav>
            </div>
        @endif

        <!-- Nút xem webhook logs -->
        <div class="flex justify-end">
            <a href="{{ route('leads.webhook_logs') }}"
                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Xem Webhook Logs</a>
        </div>
    </div>

    @push('scripts')
        <script>
            document.querySelector('form').addEventListener('submit', function () {
                document.getElementById('loading').classList.remove('hidden');
            });
        </script>
    @endpush
@endsection