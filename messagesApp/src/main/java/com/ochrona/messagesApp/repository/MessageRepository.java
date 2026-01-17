package com.ochrona.messagesApp.repository;

import com.ochrona.messagesApp.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findBySenderIdOrderByCreatedAtDesc(Long senderId);

    @Query("SELECT m FROM Message m JOIN m.recipients mr WHERE mr.recipient.id = :recipientId ORDER BY m.createdAt DESC")
    List<Message> findByRecipientIdOrderByCreatedAtDesc(@Param("recipientId") Long recipientId);
}
