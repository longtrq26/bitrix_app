<!DOCTYPE html>
<html>

<head>
    <title>Webhook Logs</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>

<body class="bg-gray-100 dark:bg-gray-900">
    <div class="container mx-auto p-4">
        <h1 class="text-2xl font-bold mb-4 dark:text-white">Webhook Logs</h1>

        @if (session('error'))
            <div class="bg-red-500 text-white p-4 rounded mb-4">
                {{ session('error') }}
            </div>
        @endif

        <table class="min-w-full bg-white dark:bg-gray-800">
            <thead>
                <tr>
                    <th class="py-2 px-4 border-b dark:border-gray-600 dark:text-white">ID</th>
                    <th class="py-2 px-4 border-b dark:border-gray-600 dark:text-white">Event</th>
                    <th class="py-2 px-4 border-b dark:border-gray-600 dark:text-white">Payload</th>
                    <th class="py-2 px-4 border-b dark:border-gray-600 dark:text-white">Created At</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($logs as $log)
                    <tr class="dark:bg-gray-800">
                        <td class="p-2 dark:text-white">{{ $log['id'] }}</td>
                        <td class="p-2 dark:text-white">{{ $log['event'] }}</td>
                        <td class="p-2 dark:text-white truncate max-w-md">{{ $log['payload'] }}</td>
                        <td class="p-2 dark:text-white">{{ \Carbon\Carbon::parse($log['createdAt'])->format('d/m/Y H:i') }}
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="4" class="p-2 text-center dark:text-white">Không có log nào</td>
                    </tr>
                @endforelse
            </tbody>
        </table>

        <!-- Phân trang -->
        <div class="mt-4">
            @if ($totalPages > 1)
                <nav class="flex justify-center">
                    <ul class="inline-flex -space-x-px">
                        @for ($i = 1; $i <= $totalPages; $i++)
                            <li>
                                <a href="{{ route('leads.webhook_logs', ['page' => $i, 'limit' => $perPage]) }}"
                                    class="px-3 py-2 {{ $i == $currentPage ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800 dark:text-white' }} border border-gray-300 dark:border-gray-600">
                                    {{ $i }}
                                </a>
                            </li>
                        @endfor
                    </ul>
                </nav>
            @endif
        </div>
    </div>
</body>

</html>