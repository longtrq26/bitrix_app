@extends('layouts.app')

@section('content')
    <h1 class="text-2xl font-bold mb-4">Create Lead</h1>

    <form id="create-lead-form" action="{{ route('leads.store') }}" method="POST" class="space-y-4">
        @csrf
        <div>
            <label for="TITLE" class="block text-sm font-medium dark:text-white">Title</label>
            <input type="text" name="TITLE" id="TITLE" class="border p-2 rounded w-full dark:bg-gray-700 dark:text-white"
                required>
            <span class="error text-red-500 hidden">Title is required</span>
        </div>
        <div>
            <label for="EMAIL" class="block text-sm font-medium dark:text-white">Email</label>
            <input type="email" name="EMAIL" id="EMAIL" class="border p-2 rounded w-full dark:bg-gray-700 dark:text-white">
            <span class="error text-red-500 hidden">Invalid email format</span>
        </div>
        <div>
            <label for="PHONE" class="block text-sm font-medium dark:text-white">Phone</label>
            <input type="text" name="PHONE" id="PHONE" class="border p-2 rounded w-full dark:bg-gray-700 dark:text-white">
            <span class="error text-red-500 hidden">Phone is required if provided</span>
        </div>
        <div>
            <label for="STATUS_ID" class="block text-sm font-medium dark:text-white">Status</label>
            <select name="STATUS_ID" id="STATUS_ID" class="border p-2 rounded w-full dark:bg-gray-700 dark:text-white">
                <option value="">Select Status</option>
                <option value="NEW">NEW</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="CONVERTED">CONVERTED</option>
                <option value="LOST">LOST</option>
            </select>
        </div>
        <div>
            <label for="SOURCE_ID" class="block text-sm font-medium dark:text-white">Source</label>
            <select name="SOURCE_ID" id="SOURCE_ID" class="border p-2 rounded w-full dark:bg-gray-700 dark:text-white">
                <option value="">Select Source</option>
                <option value="WEB">Web</option>
                <option value="CALL">Call</option>
            </select>
        </div>
        <div>
            <label for="COMMENTS" class="block text-sm font-medium dark:text-white">Comments</label>
            <textarea name="COMMENTS" id="COMMENTS"
                class="border p-2 rounded w-full dark:bg-gray-700 dark:text-white"></textarea>
        </div>
        <div>
            <label for="domain" class="block text-sm font-medium dark:text-white">Domain</label>
            <input type="text" name="domain" id="domain" value="{{ Session::get('bitrix24_domain') }}"
                class="border p-2 rounded w-full dark:bg-gray-700 dark:text-white" readonly>
            <span class="error text-red-500 hidden">Invalid domain</span>
        </div>
        <button type="submit" class="bg-blue-500 text-white p-2 rounded">Create Lead</button>
    </form>

    <script>
        $('#create-lead-form').submit(function (e) {
            e.preventDefault();
            $('.error').addClass('hidden');

            const title = $('#TITLE').val();
            const email = $('#EMAIL').val();
            const phone = $('#PHONE').val();
            const domain = $('#domain').val();

            if (!title) {
                $('#TITLE').next('.error').removeClass('hidden');
                return;
            }
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                $('#EMAIL').next('.error').removeClass('hidden');
                return;
            }
            if (phone && !phone.trim()) {
                $('#PHONE').next('.error').removeClass('hidden');
                return;
            }
            if (!/^[a-zA-Z0-9-]+\.bitrix24\.vn$/.test(domain)) {
                $('#domain').next('.error').removeClass('hidden');
                return;
            }

            $(this).find('button[type="submit"]').prop('disabled', true).text('Creating...');
            $.ajax({
                url: $(this).attr('action'),
                method: 'POST',
                data: $(this).serialize(),
                success: function () {
                    Toastify({
                        text: 'Lead created successfully',
                        duration: 3000,
                        backgroundColor: '#10B981',
                    }).showToast();
                    window.location.href = '{{ route('leads.index') }}';
                },
                error: function (xhr) {
                    const message = xhr.responseJSON?.message || 'Failed to create lead';
                    Toastify({
                        text: message,
                        duration: 3000,
                        backgroundColor: '#EF4444',
                    }).showToast();
                    $(this).find('button[type="submit"]').prop('disabled', false).text('Create Lead');
                }
            });
        });
    </script>
@endsection