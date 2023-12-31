import os
import csv

directory = '../'
csv_file = 'repo.csv'
github_url_prefix = "https://github.com/ospf2fullstack/garyinnerarity.com/blob/main"

def get_size(start_path):
    """Return the total size of the directory or file."""
    total_size = 0
    if os.path.isfile(start_path):
        # If it's a file, return its size directly
        return os.path.getsize(start_path)
    for dirpath, dirnames, filenames in os.walk(start_path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):  # skip if it is symbolic link
                total_size += os.path.getsize(fp)
    return total_size

def list_directory_structure(dir_path):
    for root, dirs, files in os.walk(dir_path):
        # Skip .git directories and its contents
        if '.git' in dirs:
            dirs.remove('.git')
        for dir_name in dirs:
            dir_path = os.path.join(root, dir_name)
            relative_path = dir_path.replace(dir_path, '').replace(os.sep, '/')
            yield get_size(dir_path), relative_path, github_url_prefix + relative_path
        for file_name in files:
            file_path = os.path.join(root, file_name)
            relative_path = file_path.replace(dir_path, '').replace(os.sep, '/')
            yield get_size(file_path), relative_path, github_url_prefix + relative_path

with open(csv_file, 'w', newline='') as file:
    writer = csv.writer(file)
    writer.writerow(['size', 'path', 'link'])  # Header
    for size, path, link in list_directory_structure(directory):
        writer.writerow([size, path, link])

print(f'Directory structure written to {csv_file}')
