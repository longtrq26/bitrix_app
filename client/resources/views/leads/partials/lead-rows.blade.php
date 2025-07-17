@foreach ($leads as $lead)
    <tr class="border-t">
        <td class="px-4 py-2">{{ $lead['ID'] }}</td>
        <td class="px-4 py-2">{{ $lead['TITLE'] }}</td>
        <td class="px-4 py-2">{{ $lead['STATUS_ID'] ?? 'N/A' }}</td>
        <td class="px-4 py-2">
            <a href="/leads/{{ $lead['ID'] }}/edit" class="text-blue-500 mr-3">Sửa</a>
            <form action="/leads/{{ $lead['ID'] }}" method="POST" class="inline-block"
                onsubmit="return confirm('Xác nhận xóa lead này?')">
                @csrf
                @method('DELETE')
                <button type="submit" class="text-red-500">Xóa</button>
            </form>
        </td>
    </tr>
@endforeach