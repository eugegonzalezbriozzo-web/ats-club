-- Fotos de perfil (256 px JPEG) y logos (PNG hasta 256 px): tamaño y tipo acotados.
update storage.buckets set file_size_limit = 1048576, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] where id = 'avatars';
update storage.buckets set file_size_limit = 2097152, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] where id = 'logos';
