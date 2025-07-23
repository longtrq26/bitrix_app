@extends('layouts.app')

@section('content')
    <div class="space-y-6">
        <!-- Form lọc log -->
        <form method="GET" action="{{ route('leads.webhook_logs') }}"
            class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Event</label>
                    <input type="text" name="event" value="{{ request('event') }}" placeholder="e.g., ONCRMLEADADD"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium dark:text-gray-300">Lead ID</label>
                    <input type="text" name="leadId" value="{{ request('leadId') }}" placeholder="Lead ID"
                        class="w-full border p-2 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="flex items-end">
                    <button type="submit"
                        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full">Lọc</button>
                </div>
            </div>
        </form>

        <!-- Bảng log -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-100 dark:bg-gray-700">
                    <tr>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">ID</th>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Event</th>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Payload</th>
                        <th class="px-6 py-3 text-left text-sm font-medium dark:text-white">Created At</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                    @forelse ($logs as $log)
                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td class="px-6 py-4 dark:text-white">{{ $log['id'] }}</td>
                            <td class="px-6 py-4 dark:text-white">{{ $log['event'] }}</td>
                            <td class="px-6 py-4 dark:text-white truncate max-w-md">{{ $log['payload'] }}</td>
                            <td class="px-6 py-4 dark:text-white">
                                {{ \Carbon\Carbon::parse($log['createdAt'])->format('d/m/Y H:i') }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="4" class="px-6 py-4 text-center dark:text-white">Không có log nào</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        <!-- Phân trang -->
        @if ($totalPages > 1)
            <div class="mt-4 flex justify-center">
                <nav class="inline-flex -space-x-px rounded-md shadow">
                    @for ($i = 1; $i <= $totalPages; $i++)
                        <a href="{{ route('leads.webhook_logs', array_merge(request()->query(), ['page' => $i, 'limit' => $perPage])) }}"
                            class="px-3 py-2 {{ $i == $currentPage ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 dark:text-white' }} border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                            {{ $i }}
                        </a>
                    @endfor
                </nav>
            </div>
        @endif
    </div>
@endsection