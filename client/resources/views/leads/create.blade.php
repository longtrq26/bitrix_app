<x-layout>
    <h1 class="text-xl font-bold mb-4">Tạo Lead mới</h1>

    <form method="POST" action="{{ route('leads.store') }}">
        @csrf
        <div class="mb-4">
            <label for="title">Tiêu đề:</label>
            <input type="text" name="title" id="title" class="border p-2 w-full" required>
        </div>

        <div class="mb-4">
            <label for="status_id">Trạng thái:</label>
            <input type="text" name="status_id" id="status_id" class="border p-2 w-full">
        </div>

        <div class="mb-4">
            <label for="source_id">Nguồn:</label>
            <input type="text" name="source_id" id="source_id" class="border p-2 w-full">
        </div>

        <button type="submit" class="bg-green-500 text-white px-4 py-2 rounded">Tạo Lead</button>
    </form>
</x-layout>